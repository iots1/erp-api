# Graceful Shutdown Investigation — `iam` (2026-07-22)

## สรุป

**Graceful shutdown ของ `iam` ไม่ทำงานตามที่ตั้งใจไว้** — request ที่กำลังประมวลผลอยู่ระหว่าง `pm2 reload` ถูกตัดตอน (connection reset) ก่อนจะเสร็จ แทนที่จะรอให้ทำงานจบก่อนแล้วค่อยปิด process

## วิธีทดสอบ

Environment: `root@172.16.0.100`, project ที่ `/root/erp-api`, pm2 (local devDependency ของ project, ไม่ใช่ global install).

1. ยิง `GET /iam/v1/users/test-graceful-shutdown` (endpoint จำลอง long-running process ด้วย `setTimeout` 15 วินาที — ดู `apps/iam/src/modules/users/controllers/users.controller.ts:61-74`)
2. ระหว่าง request ค้างอยู่ (t+3s) สั่ง `pm2 reload iam` เพื่อจำลอง deploy เวอร์ชันใหม่ (cluster mode, 2 workers)
3. จับ log จาก `pm2 logs iam` ตลอดช่วงเวลาคู่ขนานไปด้วย

## ผลการทดสอบ

- curl ได้ **`Empty reply from server`** หลังผ่านไปเพียง **5.9 วินาที** (ควรจะได้ response ที่ ~15+ วินาที)
- Worker ที่ถือ request ค้างอยู่ (pid `17413`) log ว่า:
  ```
  🛑 [IamModule] Received SIGINT, draining before shutdown...
  ```
  แล้ว**ภายในเสี้ยววินาทีเดียวกัน**เกิด error และ process ตายทันที:
  ```
  ERROR [NestApplicationContext] Error happened during shutdown
  Error: Nest could not find DataSource element (this provider does not exist in the current context)
      at InstanceLinksHost.get (.../@nestjs/core/injector/instance-links-host.js:15:19)
      at ModuleRef.find (.../@nestjs/core/injector/abstract-instance-resolver.js:8:60)
      at ModuleRef.get (.../@nestjs/core/injector/module.js:391:29)
      at TypeOrmCoreModule.onApplicationShutdown (.../@nestjs/typeorm/dist/typeorm-core.module.js:116:43)
      at callAppShutdownHook (.../@nestjs/core/hooks/on-app-shutdown.hook.js:52:35)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async NestApplication.callShutdownHook (.../@nestjs/core/nest-application-context.js:286:13)
      at async process.cleanup (.../@nestjs/core/nest-application-context.js:211:17)
  ```
- Worker ที่สอง (pid `17426`) โดน reload ทีหลังและเกิด error แบบเดียวกันเป๊ะๆ — **reproduce ได้ 100% ทั้งสอง worker**

## Root cause

ไล่โค้ดจริงใน `@nestjs/core@11.1.28` (`nest-application-context.js`, `listenToShutdownSignals`) พบว่า sequence ตอน SIGINT/SIGTERM คือ:

```
callDestroyHook()          // onModuleDestroy
  → callBeforeShutdownHook()  // beforeApplicationShutdown
  → dispose()                 // ปิด Fastify HTTP server / microservice — ควร drain in-flight requests
  → callShutdownHook()        // onApplicationShutdown
```

ทั้งหมดอยู่ใน:
```js
try { /* sequence above */ }
catch (err) {
  Logger.error(MESSAGES.ERROR_DURING_SHUTDOWN, err?.stack, ...);
  process.exit(1);   // ← hard kill ทันที ไม่สน timer ใดๆ
}
```

`TypeOrmCoreModule.onApplicationShutdown()` (จาก `@nestjs/typeorm@11.0.3`, `typeorm-core.module.js:115-128`) ทำ:
```js
async onApplicationShutdown() {
  const dataSource = this.moduleRef.get(getDataSourceToken(this.options));
  // ...
}
```
เรียก `moduleRef.get()` แล้ว **หา DataSource provider ไม่เจอในบริบทตอนนั้น** → throw `UnknownElementException` → ถูก catch โดย NestJS's `cleanup()` เอง → **`process.exit(1)` ทันที**

ผลคือ mechanism ที่ทีมออกแบบไว้ทั้งหมด (custom `GracefulShutdownService`, `SHUTDOWN_TIMEOUT_MS=30000`, socket-destroy-on-`finish` hack) **ถูกข้ามไปเลย** เพราะ exception จาก hook อื่นที่ไม่เกี่ยวกับ HTTP ทำให้ NestJS เรียก hard-exit ก่อนที่จะรอ HTTP drain เสร็จ

## สิ่งที่ตรวจสอบแล้วว่า "ไม่ใช่" สาเหตุ

- **`ecosystem.config.js` ตั้งค่าถูกต้อง** — `kill_timeout: 45000` (มากกว่า `SHUTDOWN_TIMEOUT_MS` และมากกว่า request 15s มาก) ไม่ใช่ pm2 สั่ง SIGKILL ก่อนเวลา
- **`FastifyAdapter.close()`** เรียก `fastify.close()` ตรงๆ ไม่มีการ force-close connection ผิดปกติ (Fastify v5.10.0 default `forceCloseConnections: 'idle'` ซึ่งควร drain active request ตามปกติ)
- `GracefulShutdownService` (`libs/common/src/services/graceful-shutdown.service.ts`) เองไม่ได้เรียก `app.close()` ตรงๆ — ทำงานตามที่ออกแบบไว้ (arm timer + socket hook เท่านั้น), ไม่ใช่จุดที่ throw

## ผลกระทบ

ทุกครั้งที่ deploy ใหม่ผ่าน `pm2 reload` (หรือ SIGINT/SIGTERM ใดๆ ที่ทำให้ TypeORM's `onApplicationShutdown` throw แบบนี้) — **request ที่กำลังทำงานอยู่ในขณะนั้นจะถูกตัดตอนทันที** ไม่ได้รอให้เสร็จ ซึ่งเสี่ยงต่อ data inconsistency (เช่น transaction ค้างกลางคัน, response ที่ client ไม่ได้รับ) โดยเฉพาะ endpoint ที่ทำงานนาน

## แนวทางแก้ไข (ยังไม่ได้ implement)

ต้องป้องกันไม่ให้ **hook ใดๆ ใน `onApplicationShutdown`** throw จนกระทบ sequence โดยรวม — เป็นปัญหาที่มาจาก compatibility ระหว่าง `@nestjs/core@11.1.28` กับ `@nestjs/typeorm@11.0.3` ในแอปแบบ hybrid (HTTP + RMQ microservice) ต้องขุดต่อว่าทำไม `moduleRef.get(DataSource token)` หา provider ไม่เจอตอน shutdown (สงสัยว่าเกี่ยวกับลำดับที่ `dispose()` ปิด microservice module ก่อน แล้วไปกระทบ context ที่ `TypeOrmCoreModule` ใช้อ้างอิง) — ยังต้องการการสืบสวนเพิ่มเติมเพื่อหา fix ที่ถูกต้อง (เช่น อัปเดตเวอร์ชัน `@nestjs/typeorm`, หรือ guard เฉพาะจุดนี้)

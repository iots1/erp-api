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

## Root cause (ยืนยันแล้ว)

มี 2 ชั้นซ้อนกัน — ชั้นนอกคือกลไก NestJS ที่เปลี่ยน error ให้กลายเป็น hard-exit, ชั้นในคือ **bug จาก named DataSource + `forRootAsync` ของ `@nestjs/typeorm`** ที่ทำให้ error เกิดตั้งแต่แรก

### ชั้นนอก — ทำไม error ตัวเดียวถึง kill ทั้ง process

ไล่โค้ดจริงใน `@nestjs/core@11.1.28` (`nest-application-context.js`, `listenToShutdownSignals`) พบว่า sequence ตอน SIGINT/SIGTERM คือ:

```
callDestroyHook()          // onModuleDestroy
  → callBeforeShutdownHook()  // beforeApplicationShutdown
  → dispose()                 // ปิด Fastify HTTP server / microservice — ควร drain in-flight requests
  → callShutdownHook()        // onApplicationShutdown  ← throw ตรงนี้
```

ทั้งหมดอยู่ใน `try/catch` เดียว:
```js
try { /* sequence above */ }
catch (err) {
  Logger.error(MESSAGES.ERROR_DURING_SHUTDOWN, err?.stack, ...);
  process.exit(1);   // ← hard kill ทันที ไม่สน timer ใดๆ
}
```

ดังนั้น **exception จาก hook ตัวไหนก็ตาม** (แม้จะไม่เกี่ยวกับ HTTP) ทำให้ NestJS เรียก `process.exit(1)` ทันที → mechanism ที่ทีมออกแบบไว้ (custom `GracefulShutdownService`, `SHUTDOWN_TIMEOUT_MS=30000`, socket-destroy-on-`finish`, pm2 `kill_timeout:45000`) **ถูกข้ามหมด**

### ชั้นใน — ทำไม `TypeOrmCoreModule.onApplicationShutdown()` ถึง throw

`typeorm-core.module.js:115` ทำแค่:
```js
async onApplicationShutdown() {
  const dataSource = this.moduleRef.get(getDataSourceToken(this.options));  // ← throw ที่บรรทัดนี้
  ...
}
```

ต้นเหตุจริงคือ **DI token ที่ใช้ตอน register กับตอน shutdown ไม่ตรงกัน** เมื่อใช้ named DataSource ผ่าน `forRootAsync`:

**ตอน register** (`DatabaseModule.registerAsync(ErpDatabases.IAM)` → `TypeOrmModule.forRootAsync({ name: 'erp_iam', useFactory })`):
- `dataSourceProvider.provide = getDataSourceToken(options)` โดย `options = { name: 'erp_iam', ... }`
- → DataSource ถูก register ไว้ใต้ token string **`'erp_iamDataSource'`** ✓

**ค่า `this.options`** (ที่ constructor ของ `TypeOrmCoreModule` inject มาจาก `TYPEORM_MODULE_OPTIONS`):
- `forRootAsync` ตั้ง `TYPEORM_MODULE_OPTIONS` = **ผลลัพธ์ดิบจาก `useFactory` ของเรา** (`createAsyncOptionsProvider`)
- `useFactory` ใน `libs/database/src/database.module.ts` return `{ type:'postgres', host, port, ... }` — **ไม่มี field `name`** (ชื่อ connection อยู่บน config ชั้นนอกของ `forRootAsync` ไม่ใช่ใน object ที่ factory คืน)
- → `this.options.name === undefined`

**ตอน shutdown**:
- `getDataSourceToken(this.options)` → `getName(this.options)` = `undefined` → เข้าเงื่อนไข `!getName(dataSource)` → คืน **default token `DataSource` (class)** ไม่ใช่ `'erp_iamDataSource'`
- `this.moduleRef.get(DataSource)` → ทุก BC เป็น named DataSource ล้วน **ไม่มี provider ใต้ default token `DataSource` เลย** → throw `UnknownElementException: "Nest could not find DataSource element"`

**ทำไม runtime ใช้งานได้ปกติ:** repository ทุกตัว inject ผ่านชื่อ connection — `@InjectRepository(User, ErpDatabases.IAM)` / `forFeature([...], ErpDatabases.IAM)` — ซึ่ง resolve ผ่าน string `'erp_iam'` → `getDataSourceToken('erp_iam')` → `'erp_iamDataSource'` (ถูก) มีแค่ `onApplicationShutdown` เท่านั้นที่ resolve token จาก `this.options` (ที่ทำ `name` หาย)

### ขอบเขตผลกระทบ
เป็น latent bug ของ **ทุก BC** ไม่ใช่แค่ `iam` เพราะทุกตัวใช้ `DatabaseModule.registerAsync()` ตัวเดียวกัน (`libs/database/src/database.module.ts`) และเป็น named DataSource ทั้งหมด (ไม่มี default datasource เลยในทั้ง repo)

## แนวทางแก้ (fix ที่จุดเดียว ครอบทุก BC)

เพิ่ม `name: connectionName` เข้าไปใน object ที่ `useFactory` คืนใน `libs/database/src/database.module.ts` เพื่อให้ `TYPEORM_MODULE_OPTIONS` (= `this.options`) พก `name` ติดไปด้วย:

```ts
useFactory: (configService: ConfigService) => ({
  name: connectionName,   // ← เพิ่มบรรทัดนี้
  type: 'postgres',
  host: configService.get<string>(`${prefix}_HOST`),
  ...
}),
```

ผลลัพธ์: ตอน shutdown `getDataSourceToken(this.options)` → `'erp_iamDataSource'` (ถูกต้อง) → `moduleRef.get()` สำเร็จ → `dataSource.destroy()` ทำงานปกติ ไม่ throw → NestJS ไม่เรียก `process.exit(1)` → HTTP drain in-flight requests จนจบตาม `GracefulShutdownService` ที่ออกแบบไว้

หมายเหตุ: ค่า `name` ที่เพิ่มเข้าไปมีค่าเท่ากับ `options.name` ที่ `forRootAsync` merge ให้อยู่แล้วตอนสร้าง DataSource (`{...typeOrmOptions, name: options.name}`) จึงไม่กระทบ path การสร้าง connection — เป็นการเติมสิ่งที่ควรมีตั้งแต่แรกให้ครบเท่านั้น (typeorm 0.3.31 ยังรับ `name` บน options ได้แบบ backward-compatible)

**ยังไม่ได้ apply** — ต้องแก้ 1 บรรทัด แล้ว rebuild (`dist/`) + `pm2 reload` บน server เพื่อทดสอบซ้ำว่า request 15s ได้ response ครบก่อน process ปิดจริง

## สิ่งที่ตรวจสอบแล้วว่า "ไม่ใช่" สาเหตุ

- **`ecosystem.config.js` ตั้งค่าถูกต้อง** — `kill_timeout: 45000` (มากกว่า `SHUTDOWN_TIMEOUT_MS` และมากกว่า request 15s มาก) ไม่ใช่ pm2 สั่ง SIGKILL ก่อนเวลา
- **`FastifyAdapter.close()`** เรียก `fastify.close()` ตรงๆ ไม่มีการ force-close connection ผิดปกติ (Fastify v5.10.0 default `forceCloseConnections: 'idle'` ซึ่งควร drain active request ตามปกติ)
- `GracefulShutdownService` (`libs/common/src/services/graceful-shutdown.service.ts`) เองไม่ได้เรียก `app.close()` ตรงๆ — ทำงานตามที่ออกแบบไว้ (arm timer + socket hook เท่านั้น), ไม่ใช่จุดที่ throw

## ผลกระทบ

ทุกครั้งที่ deploy ใหม่ผ่าน `pm2 reload` (หรือ SIGINT/SIGTERM ใดๆ ที่ทำให้ TypeORM's `onApplicationShutdown` throw แบบนี้) — **request ที่กำลังทำงานอยู่ในขณะนั้นจะถูกตัดตอนทันที** ไม่ได้รอให้เสร็จ ซึ่งเสี่ยงต่อ data inconsistency (เช่น transaction ค้างกลางคัน, response ที่ client ไม่ได้รับ) โดยเฉพาะ endpoint ที่ทำงานนาน

## แนวทางแก้ไข (ยังไม่ได้ implement)

ต้องป้องกันไม่ให้ **hook ใดๆ ใน `onApplicationShutdown`** throw จนกระทบ sequence โดยรวม — เป็นปัญหาที่มาจาก compatibility ระหว่าง `@nestjs/core@11.1.28` กับ `@nestjs/typeorm@11.0.3` ในแอปแบบ hybrid (HTTP + RMQ microservice) ต้องขุดต่อว่าทำไม `moduleRef.get(DataSource token)` หา provider ไม่เจอตอน shutdown (สงสัยว่าเกี่ยวกับลำดับที่ `dispose()` ปิด microservice module ก่อน แล้วไปกระทบ context ที่ `TypeOrmCoreModule` ใช้อ้างอิง) — ยังต้องการการสืบสวนเพิ่มเติมเพื่อหา fix ที่ถูกต้อง (เช่น อัปเดตเวอร์ชัน `@nestjs/typeorm`, หรือ guard เฉพาะจุดนี้)

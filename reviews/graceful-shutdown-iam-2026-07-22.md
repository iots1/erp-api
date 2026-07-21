# Graceful Shutdown Investigation — `iam` (2026-07-22)

## สรุป

ทดสอบจริงบน `root@172.16.0.100` ด้วยการยิง request ค้าง 15 วิ แล้วสั่ง `pm2 reload iam` กลางคัน เจอ **3 บัคซ้อนกัน** ที่ทำให้ graceful shutdown ไม่ทำงาน แก้ครบทั้ง 3 จุดแล้ว และ **ยืนยันด้วย live test (rebuild + `pm2 reload`) ผ่านครบทุกจุด** — request 15 วิ ได้ response `200` เต็มทั้งที่โดน reload กลางคัน ไม่มี error / 403 / connection ถูกตัดอีก

**สถานะสุดท้าย: ✅ ผ่านครบทุกจุด** — re-test หลังแก้ครบทั้ง 3 บัคได้ `HTTP_CODE:200`, `TIME_TOTAL:15.012s` พร้อม response เต็ม `{"message":"Long-running process completed successfully!"}` ทั้งที่โดน `pm2 reload` กลางคัน

| # | บัค | ไฟล์ | สถานะ |
|---|---|---|---|
| 1 | `TypeOrmCoreModule.onApplicationShutdown()` throw → NestJS `process.exit(1)` | `libs/database/src/database.module.ts` | ✅ Fixed + verified |
| 2 | test endpoint โดน default-deny 403 (ไม่เกี่ยวกับ shutdown แต่บล็อกการทดสอบ) | `apps/iam/.../users.controller.ts` | ✅ Fixed + verified |
| 3 | **Fastify `close()` ทำลาย connection ที่กำลังทำงานอยู่ทันที (root cause ตัวจริง)** | `libs/common/src/utils/bootstrap.util.ts` | ✅ Fixed + verified |

## วิธีทดสอบ

Environment: `root@172.16.0.100`, project ที่ `/root/erp-api`, pm2 (local devDependency, ไม่ใช่ global)

1. ยิง `GET /iam/v1/users/test-graceful-shutdown` (endpoint จำลอง long-running process ด้วย `setTimeout` 15 วินาที — `apps/iam/src/modules/users/controllers/users.controller.ts`)
2. ระหว่าง request ค้างอยู่ (t+3s) สั่ง `pm2 reload iam` จำลอง deploy เวอร์ชันใหม่ (cluster mode, 2 workers)
3. จับ log จาก `pm2 logs iam` คู่ขนานไปด้วย

---

## บัคที่ 1 — TypeOrmCoreModule.onApplicationShutdown() throw

### ผลการทดสอบรอบแรก
curl ได้ **`Empty reply from server`** หลังผ่านไปเพียง **5.9 วินาที**. Worker ที่ถือ request (pid `17413`) log:
```
🛑 [IamModule] Received SIGINT, draining before shutdown...
```
แล้ว**ภายในเสี้ยววินาทีเดียวกัน**:
```
ERROR [NestApplicationContext] Error happened during shutdown
Error: Nest could not find DataSource element (this provider does not exist in the current context)
    at TypeOrmCoreModule.onApplicationShutdown (.../@nestjs/typeorm/dist/typeorm-core.module.js:116:43)
    at async process.cleanup (.../@nestjs/core/nest-application-context.js:211:17)
```
Worker ที่สอง (`17426`) เจอ error เดียวกันเป๊ะ — reproduce 100%

### Root cause
NestJS's `listenToShutdownSignals` (`nest-application-context.js`) รัน sequence `callDestroyHook → callBeforeShutdownHook → dispose() → callShutdownHook` ทั้งหมดใน `try/catch` เดียวที่ `catch` แล้วเรียก **`process.exit(1)` ทันที** — exception จาก hook ไหนก็ตามจึง hard-kill ทั้ง process ทันที ไม่รอ HTTP drain

`TypeOrmCoreModule.onApplicationShutdown()` throw เพราะ **DI token ไม่ตรงกัน** ระหว่างตอน register กับตอน shutdown เมื่อใช้ named DataSource ผ่าน `forRootAsync`:

- **ตอน register**: `getDataSourceToken({name:'erp_iam'})` → token `'erp_iamDataSource'` ✓
- **ตอน shutdown**: `TypeOrmCoreModule` เก็บ `this.options` จาก `TYPEORM_MODULE_OPTIONS` ซึ่งเป็น**ผลลัพธ์ดิบจาก `useFactory`** — และ `useFactory` เดิมใน `libs/database/src/database.module.ts` คืน `{type:'postgres', host, ...}` **ไม่มี field `name`** → `getDataSourceToken(this.options)` หา name ไม่เจอ → fallback เป็น default token `DataSource` (class) → ทุก BC เป็น named DataSource ล้วน ไม่มี provider ใต้ default token เลย → throw

runtime ใช้งานได้ปกติเพราะ repository inject ผ่านชื่อ (`@InjectRepository(User, ErpDatabases.IAM)`) ซึ่ง resolve ถูก — มีแค่ shutdown hook ที่ resolve จาก `this.options` เท่านั้นที่พลาด เป็น **latent bug ของทุก BC** เพราะใช้ `DatabaseModule.registerAsync()` เดียวกันหมด

### Fix (applied)
`libs/database/src/database.module.ts` — เพิ่ม `name: connectionName` ใน object ที่ `useFactory` คืน:
```ts
useFactory: (configService: ConfigService) => ({
  name: connectionName,   // ← เพิ่ม
  type: 'postgres',
  ...
}),
```

### ยืนยันด้วย re-test
รัน test ซ้ำ (deploy ใหม่แล้ว) — **error "could not find DataSource" หายไปแล้ว** ไม่มี ERROR log ปรากฏอีกในช่วง shutdown ✅

---

## บัคที่ 2 — test endpoint โดน 403 default-deny

### ที่พบ
Re-test รอบสอง (หลัง fix บัค #1) curl ได้ 403 ทันที (0.058s) แทนที่จะเข้าไปถึง handler:
```json
{"status":{"code":403,...},"errors":[{"code":"FORBIDDEN","detail":"This endpoint is missing @RequirePermission() — default deny."}]}
```

### Root cause
`test-graceful-shutdown` (เพิ่มใน commit `d19f9e3`) ไม่เคยมี `@RequirePermission()` หรือ `@Public()` เลย — โดนกฎ default-deny ของระบบตามปกติ (ไม่เกี่ยวกับ graceful shutdown, เป็นแค่ตัวบล็อกการทดสอบ)

### Fix (applied)
เพิ่ม `@Public()` ให้ endpoint นี้ใน `apps/iam/src/modules/users/controllers/users.controller.ts` (import `Public` จาก `@lib/common`)

### ยืนยันด้วย re-test
Re-test รอบสาม — เข้าถึง handler ได้แล้ว (`⏳ [Test] เริ่มทำงาน Request...` ปรากฏใน log) ไม่มี 403 อีก ✅

---

## บัคที่ 3 — Fastify `close()` ทำลาย active connection ทันที (root cause ตัวจริง)

### ที่พบ
Re-test รอบสาม (หลัง fix บัค #1 และ #2) — **curl ยังได้ `Empty reply from server` ที่ ~5.9 วินาทีเหมือนเดิม** แต่รอบนี้**ไม่มี ERROR log ใดๆ เลย** ทั้งสอง worker แค่ log `🛑 Received SIGINT, draining before shutdown...` แล้วเงียบไปเลย ไม่มี `✅ [Test] ทำงานเสร็จสิ้น` — แปลว่า connection ถูกตัดโดยกลไกที่ไม่ throw error และไม่ log อะไรเลย

### การไล่หา root cause
ตรวจสอบและตัดออกทีละอย่าง:
- `ecosystem.config.js`: `kill_timeout: 45000` ถูกต้อง (มากกว่า request 15s เยอะ), ยืนยันด้วย `pm2 jlist` ว่า pm2 process ที่รันอยู่จริง**ก็ใช้ค่านี้จริง** (ไม่ใช่ค่า cache เก่า) → ไม่ใช่ pm2
- `SHUTDOWN_TIMEOUT_MS=30000` ใน `.env` บน server → ไม่ใช่ force-exit timer ของแอปเอง (ไม่มี log "Shutdown exceeded" ด้วย)
- `GracefulShutdownService` เอง (`libs/common/src/services/graceful-shutdown.service.ts`) ไม่ได้เรียก `app.close()` ตรงๆ — ไม่ใช่จุดนี้

**สร้าง isolated repro** (plain Fastify server เดี่ยวๆ ไม่มี NestJS/PM2 เกี่ยวข้องเลย — Fastify v5.10.0 + Node v24.18.0 ตัวเดียวกับ server):
```js
app.get('/slow', async () => { await sleep(5000); return {ok:true}; });
// t+1s ระหว่าง request ค้าง:
await app.close();  // ← resolved after 2ms, curl ได้ Empty reply ทันที
```
**Reproduce ได้ทันทีแบบ 100%** — ยืนยันว่านี่คือ Fastify's own behavior ไม่เกี่ยวกับโค้ดแอปเลย

### Root cause ที่แท้จริง
ใน `fastify/fastify.js` (v5.10.0), close hook:
```js
if (forceCloseConnections === 'idle' && options.serverFactory) {
  instance.server.closeIdleConnections()
} else if (serverHasCloseAllConnections && forceCloseConnections) {
  instance.server.closeAllConnections()   // ← โดนเรียกจริง
}
```
`forceCloseConnections` ที่ไม่ได้ตั้งค่า จะ default เป็น **string `'idle'`** (ไม่ใช่ boolean) เงื่อนไขแรก (`closeIdleConnections()` — ปิดแค่ connection ที่ idle จริงๆ) ต้องการ `options.serverFactory` ด้วย ซึ่งแทบไม่มีใครตั้งค่า → ตกไป `else if` ถัดไป ซึ่งเช็คแค่ `forceCloseConnections` เป็น truthy — และ **string `'idle'` เป็น truthy** → เข้าเงื่อนไขนี้แทน → เรียก **`closeAllConnections()`** ซึ่ง**ทำลายทุก connection ทั้ง idle และ active** ทันที ไม่ใช่แค่ idle ตามชื่อ default value

นี่คือพฤติกรรม default ของ Fastify v5.10.0 เอง (ดูเหมือนจะเป็น edge-case/gotcha ของ upstream ที่ทำงานผิดจากที่ตั้งใจ เมื่อไม่ได้ตั้ง `serverFactory`) **ไม่เกี่ยวกับ pm2, ecosystem.config.js, หรือ GracefulShutdownService ที่ทีมเขียนไว้เลย** — เป็นเหตุผลที่แท้จริงว่าทำไม request ถึงถูกตัดตอนเสมอ ไม่ว่าจะ fix บัค #1/#2 แล้วหรือไม่

### ยืนยันด้วย isolated repro
ตั้ง `forceCloseConnections: false` ตรงๆ → repro เดิมได้ผลถูกต้อง: client ได้ response `200` ครบหลัง 5s, `app.close()` resolve หลัง request จบจริง (4431ms ตรงกับเวลาที่เหลือของ delay 5s) ✅

### Fix (applied)
`libs/common/src/utils/bootstrap.util.ts` — เพิ่ม `forceCloseConnections: false` ตรงจุดสร้าง `FastifyAdapter`:
```ts
const adapter = new FastifyAdapter({
  trustProxy,
  logger: false,
  forceCloseConnections: false,
});
```
จุดนี้ใช้ร่วมกันทุก BC (`bootstrapApplication()`) ดังนั้น**แก้ครั้งเดียวครอบทุก BC** เหมือนบัค #1

### ยืนยันด้วย re-test (รอบสุดท้าย)
Rebuild + `pm2 reload iam` แล้วรัน test เดิม — **ผ่าน**:
```
=== curl result ===
{"data":{"type":"users","attributes":{"message":"Long-running process completed successfully!"}},
 "status":{"code":200000,"message":"Request Succeeded"}}
HTTP_CODE:200
TIME_TOTAL:15.012361
```
Log sequence ยืนยันพฤติกรรมถูกต้อง:
```
⏳ [Test] เริ่มทำงาน Request...              (request เริ่ม)
🛑 Received SIGINT, draining before shutdown  (reload สั่ง SIGINT เข้ามากลางคัน)
✅ [Test] ทำงานเสร็จสิ้น ส่ง Response กลับ!     (request ทำงานต่อจนจบ *หลัง* SIGINT)
```
ไม่มี ERROR / "could not find DataSource" / "Shutdown exceeded" / "forcing exit" — process รอ in-flight request จนเสร็จก่อนปิดตัว ตรงตาม `GracefulShutdownService` ที่ออกแบบไว้ ✅

## บทสรุป
Graceful shutdown ตอนนี้ทำงานถูกต้องครบวงจร ทั้ง 3 fix อยู่ในจุด shared (`bootstrap.util.ts`, `database.module.ts`) จึงมีผลกับ **ทุก BC** ไม่ใช่แค่ `iam`

หมายเหตุ: endpoint `test-graceful-shutdown` + `@Public()` เป็น test scaffolding — พิจารณาลบออกก่อน merge ขึ้น production ถ้าไม่ต้องการเก็บไว้เป็นเครื่องมือทดสอบถาวร

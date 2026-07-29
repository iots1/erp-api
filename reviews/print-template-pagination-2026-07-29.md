# Print Template — Pagination / Banded Report Engine (2026-07-29)

## สรุป

ปัจจุบัน `report-bc` ทำได้แค่ **HTML หนึ่งก้อน → Gotenberg → PDF** พร้อม `{{key}}` string substitution
เท่านั้น ซึ่งไม่พอสำหรับเอกสารจริง (ใบกำกับภาษี/ใบเสร็จ) ที่ต้องการ:

| # | ความต้องการ | สถานะปัจจุบัน |
|---|---|---|
| 1 | วน loop รายการสินค้า (dynamic rows) | ❌ ไม่มี — `params` เป็น `Record<string, string>` ล้วน |
| 2 | header ซ้ำทุกหน้า (บล็อกลูกค้า/ผู้ขาย/เลขที่เอกสาร) | ❌ ไม่มี |
| 3 | เลขหน้า `หน้าที่ 1 จาก 2` | ❌ ไม่มี |
| 4 | กล่อง detail สูงคงที่ + filler เมื่อแถวไม่เต็ม | ❌ ไม่มี |
| 5 | เงื่อนไข "กี่แถวขึ้นหน้าใหม่" | ❌ ไม่มี |
| 6 | footer หน้าสุดท้ายต่างจากหน้าอื่น (สรุปยอด/VAT/ช่องชำระเงิน vs "มีต่อหน้า N") | ❌ ไม่มี |
| 7 | กันไม่ให้บล็อกสรุปถูกตัดครึ่งหน้า (reserve space) | ❌ ไม่มี |

เอกสารนี้เสนอ **banded report model** (แบบเดียวกับ JasperReports / Crystal / SAP) มาแทน
พร้อมผลทดสอบจริงกับ Gotenberg บน `172.16.0.220:3009` เพื่อยืนยันว่ากลไกไหนใช้ได้จริง

> **หลักฐานสำคัญจากรูปตัวอย่าง Makro**: หน้า 2 มีตารางรายการสินค้าที่ **ว่างเปล่าแต่ตีเส้นครบทุกคอลัมน์**
> — flow-based CSS ปกติไม่มีทางสร้างผลลัพธ์แบบนี้ได้ นี่คือลายเซ็นของ **banded report engine**
> ที่วาด detail band สูงคงที่เสมอไม่ว่าจะมีข้อมูลกี่แถว ยืนยันว่าทิศทาง banded ถูกต้องกับ use case จริง

> **อัปเดต 2026-07-29 (รอบ 2) — Prototype รันจริงแล้ว ไม่ใช่แค่ทฤษฎี**: แปลง HTML ของ
> `print_templates` id `6007fe4d-4eb5-42d2-b4e7-b8205c110c5a` (PAYMENT_RECEIPT ตัวจริงใน DB) เป็น
> banded template ล้วน (ยืนยันด้วยสคริปต์ว่าไม่มีค่า hardcode เหลือ) เขียน paginator ตัวจริง ยิงข้อมูล
> จำลองหลายขนาด (1/3/12/24/25/60 รายการ) เข้า Gotenberg จริงที่ `172.16.0.220:3009` แล้ว **ตรวจผลด้วย
> การ render PDF เป็นภาพ** (ไม่ใช่แค่ text extraction) — สถาปัตยกรรมทำงานถูกต้องครบทุกเคส (header ซ้ำ,
> เลขหน้า X/Y, detail band ว่างแต่ตีเส้นตอนไม่มีรายการเหลือ, ตัดหน้าอัตโนมัติตามจำนวนจริง, บล็อกส่วนลด
> ล้นไปหน้าใหม่เองเมื่อรายการเต็มพอดี, summary ไปหน้าสุดท้ายถูกต้อง) แต่เจอบั๊กจริงหนึ่งจุดที่ต้องรู้ไว้
> ก่อนเข้า Phase 2 — ดู **ข้อ 3.4** ด้านล่าง

---

## 1. ผลทดสอบจริง — กลไกแบ่งหน้าที่ Gotenberg รองรับ

ทดสอบยิงตรงเข้า `POST /forms/chromium/convert/html` ที่ `172.16.0.220:3009` ด้วย HTML ตาราง 60–80 แถว
แล้วแกะ PDF ด้วย `pypdf` เช็คว่าแต่ละหน้ามีอะไรบ้าง **ทุกแถวคือผลรันจริง ไม่ใช่การอนุมาน**

| กลไก | header ซ้ำทุกหน้า | เลขหน้า X/Y | ผลทดสอบ |
|---|---|---|---|
| `<thead>` + `emulatedMediaType=print` | ✅ ซ้ำครบ | ❌ | ✅ ยืนยันแล้ว |
| `<thead>` + `emulatedMediaType=screen` | ❌ **หน้าแรกเท่านั้น** | ❌ | ✅ ยืนยันแล้ว |
| `<tfoot>` + `print` | ✅ ซ้ำทุกหน้า | ❌ | ✅ ยืนยันแล้ว |
| `<tfoot>` + `screen` | หน้าสุดท้ายเท่านั้น | ❌ | ✅ ยืนยันแล้ว |
| `position: fixed` | ❌ **หน้าแรกเท่านั้น** | ❌ | ✅ ยืนยันแล้ว |
| Gotenberg `header.html`/`footer.html` | ✅ (คนละ render context) | ✅ `pageNumber`/`totalPages` | ✅ ยืนยันแล้ว |
| Paged.js (polyfill ฝังในหน้า) | ✅ `position: running()` | ✅ `counter(page)`/`counter(pages)` | ✅ ยืนยันแล้ว |
| Server-side chunking | ✅ by construction | ✅ by construction | — (จริงโดยนิยาม) |

### ข้อสังเกตจากการทดสอบ

- **`position: fixed` ใช้ไม่ได้** — Chromium รุ่นใหม่เลิกพฤติกรรม "fixed element ซ้ำทุกหน้าตอนพิมพ์"
  แล้ว ทดสอบได้ `FIXED-HEADER` โผล่แค่หน้า 1 (หลายบทความบนเน็ตยังแนะนำวิธีนี้อยู่ — **ใช้ไม่ได้จริง**)
- **Gotenberg header/footer รองรับเลขหน้าเนทีฟ** — `<span class="pageNumber">` / `<span class="totalPages">`
  ทำงานถูกต้อง (ได้ `หน้าที่ 1 จาก 2` จริง) แต่ render ใน **context แยกต่างหาก** ที่เข้าไม่ถึง CSS/ฟอนต์
  ของหน้าเอกสาร → **ฟอนต์ไทยต้องฝัง base64 ซ้ำใน `header.html` เอง** และต้องกันพื้นที่ด้วย
  `marginTop`/`marginBottom` เอง — สไตล์ซับซ้อนแบบบล็อกลูกค้าของ Makro ทำได้ยากมาก
- **Paged.js ทำงานได้ใน Gotenberg** — polyfill `@page { @top-center { content: counter(page) } }` ซึ่ง
  **Chromium ไม่รองรับเนทีฟ** ได้สำเร็จ, `waitForExpression` ดักด้วย `.pagedjs_page` ได้ แต่ payload
  ใหญ่ ~900KB ต่อการ render หนึ่งครั้ง และการซ้ำ `<thead>` ยังไม่สมบูรณ์

---

## 2. ⚠️ Regression ที่ต้องแก้ก่อน — `emulatedMediaType: screen`

`gotenberg.service.ts:50` ตั้ง `emulatedMediaType = 'screen'` ไว้ (เพิ่มเมื่อ 2026-07-29 ในเซสชันเดียวกับ
ที่ยังใช้ iframe `srcdoc` เป็น preview) — จากตารางข้อ 1 ค่านี้ **ปิดการซ้ำ `<thead>` ทุกหน้า** ซึ่งเป็น
กลไกหลักที่ requirement ข้อ 2 ต้องใช้

เหตุผลเดิมที่ใส่คือ *"ให้ตรงกับ preview ที่ iframe render แบบ screen"* — แต่ตอนนี้ **preview เปลี่ยนไปเรียก
Gotenberg ตัวจริงผ่าน `POST /print-templates/preview` แล้ว** (เซสชันเดียวกัน) เหตุผลนั้นจึงหมดไปทั้งหมด
preview กับ output วิ่งผ่าน code path เดียวกันเป๊ะอยู่แล้ว

**สิ่งที่ต้องทำ**: เปลี่ยนกลับเป็น `print` (ค่า default ของ Chromium) และเปิดให้ override รายเทมเพลตได้
ผลข้างเคียงที่ต้องรู้: `@media print { ... }` ในเทมเพลตจะเริ่มมีผลจริง — เทมเพลต `PAYMENT_RECEIPT`
ปัจจุบันมีบล็อก `@media print` อยู่แล้ว ต้องตรวจ regression หลังสลับ

---

## 3. สถาปัตยกรรมที่เสนอ — Banded Report Model

### 3.1 โครงสร้าง band

```
┌─────────────────────────────────────┐
│  page_header      (ซ้ำทุกหน้า)       │  ← สูงคงที่ ~55mm (Makro: ผู้ขาย+ลูกค้า+เลขที่เอกสาร)
├─────────────────────────────────────┤
│  detail_header    (ซ้ำทุกหน้า)       │  ← หัวคอลัมน์ ITEM/DESCRIPTION/QTY/...
│  ┌─────────────────────────────────┐│
│  │ detail_row × N                  ││  ← dynamic — ตัดหน้าที่นี่
│  │ filler_row × M (ตีเส้น ไม่มีข้อมูล)││  ← ทำให้กล่องสูงคงที่เสมอ
│  └─────────────────────────────────┘│
├─────────────────────────────────────┤
│  summary          (หน้าสุดท้ายเท่านั้น)│  ← VAT breakdown / เงื่อนไข / ช่องชำระเงิน / barcode
├─────────────────────────────────────┤
│  page_footer                        │  ← หน้าอื่น: "มีต่อหน้า N" / หน้าสุดท้าย: ว่างหรือข้อความปิด
└─────────────────────────────────────┘
```

### 3.2 สัญญาการเขียนเทมเพลต (template authoring contract)

**คงไฟล์เดียวไว้เหมือนเดิม** — ไม่ต้องแตะ `html_bucket`/`html_path` และ editor ในหน้า admin ยังแก้ไฟล์
เดียวได้เหมือนเดิม แค่ประกาศ band ด้วย `<template data-band="...">` ซึ่งเบราว์เซอร์ไม่ render อยู่แล้ว
(preview จึงไม่พัง แม้ยังไม่ implement engine)

```html
<template data-band="page-header">
  <!-- ใช้ {{ }} หรือ EJS ได้ตามปกติ -->
  <div class="hdr">... {{customer_name}} ... หน้าที่ {{__page}} จาก {{__pages}}</div>
</template>

<template data-band="detail-header">
  <tr><th>ITEM</th><th>DESCRIPTION</th><th>QTY</th>...</tr>
</template>

<template data-band="detail-row">
  <tr><td>{{__row_index}}</td><td>{{item.description}}</td><td>{{item.qty}}</td>...</tr>
</template>

<template data-band="filler-row">
  <tr class="filler"><td>&nbsp;</td><td></td><td></td>...</tr>
</template>

<template data-band="summary" data-reserve-mm="95">
  <!-- แสดงเฉพาะหน้าสุดท้าย; data-reserve-mm = พื้นที่ที่ต้องกันไว้ -->
</template>

<template data-band="page-footer" data-when="continuation">
  <div class="text-right">มีต่อหน้า {{__next_page}}</div>
</template>

<template data-band="page-footer" data-when="last"></template>
```

**ตัวแปรระบบ** (engine เติมให้เอง ขึ้นต้นด้วย `__`): `__page`, `__pages`, `__next_page`,
`__is_last_page`, `__row_index`, `__rows_on_page`

### 3.3 กลไกแบ่งหน้า — 3 ทางเลือก

| | A. Server-side chunk (คงที่) | B. In-page paginator ⭐ | C. Paged.js |
|---|---|---|---|
| วิธี | server หั่นตาม `rows_per_page` ที่ตั้งไว้ | ฝัง JS เล็ก ๆ ในหน้า **วัดความสูงจริง** แล้วหั่นก่อน print | ใช้ polyfill สำเร็จรูป |
| แถวสูงไม่เท่ากัน (ข้อความตัดบรรทัด) | ❌ ต้องเดา/ประมาณ | ✅ วัดจริง | ✅ วัดจริง |
| filler + กล่องสูงคงที่ | ✅ ควบคุมเต็มที่ | ✅ ควบคุมเต็มที่ | ⚠️ ต้อง hack |
| footer หน้าสุดท้ายต่าง | ✅ ง่าย | ✅ ง่าย | ⚠️ `@page :last` ไม่เสถียร |
| reserve space ให้ summary | ✅ | ✅ | ⚠️ |
| เลขหน้า X/Y | ✅ | ✅ | ✅ |
| ขนาด payload | เล็ก | +~5KB | +~900KB |
| จำนวน Gotenberg call | 1 | 1 | 1 |
| งานที่ต้องเขียนเอง | น้อย | **ปานกลาง (ตัวหลัก)** | น้อยมาก |

**แนะนำ: B — In-page paginator** เขียน script เล็ก ๆ (~150 บรรทัด) ที่รันใน Chromium ของ Gotenberg เอง:

```
1. engine (server) เอา data + band templates ประกอบเป็น HTML ที่มี "แถวทั้งหมด" อยู่ในกล่องซ่อน
2. script ในหน้าวัดความสูงจริงของทุกแถว (offsetHeight) — จับข้อความตัดบรรทัดได้แม่นยำ
3. ไล่เติมแถวลงหน้าปัจจุบันจนเกิน budget → ขึ้นหน้าใหม่ (เผื่อ data-reserve-mm ในหน้าสุดท้าย)
4. เติม filler-row ให้ครบความสูงกล่อง
5. clone page-header ทุกหน้า + เลือก page-footer ตาม continuation/last
6. เติม __page/__pages ย้อนกลับ (รู้ยอดรวมแล้วตอนนี้)
7. set window.__PAGINATION_DONE = true
```

ฝั่ง `gotenberg.service.ts` ดักด้วย
`waitForExpression: "window.__PAGINATION_DONE === true && document.fonts.status === 'loaded'"`

ได้ทั้งความแม่นยำของการวัดจริงและการควบคุมแบบ banded เต็มที่ ใน Gotenberg call เดียว
(A ใช้ไม่ได้จริงเพราะรูป Makro มีแถวที่ข้อความตัดบรรทัด — item 7 และ 11 — ทำให้สูตรแถวคงที่พังทันที)

### 3.4 ⚠️ Gotcha ที่เจอจริงตอนทำ prototype — `table{height:100%}` ในกล่อง `flex-grow` วัดความสูงไม่ได้

เทมเพลตต้นฉบับ (และโค้ด paginator เวอร์ชันแรกที่ทำตาม pattern เดียวกัน) ใช้:

```css
.rp-detail { flex-grow: 1; }         /* ให้กล่อง detail ยืดเติมที่ว่างที่เหลือของหน้า */
table.table-items { height: 100%; }  /* ให้ตารางเต็มกล่อง detail พอดี */
```

แล้วเช็ค overflow ด้วย `tbody.offsetHeight > budget` (budget = ความสูงที่ `flex-grow` ให้มา) — **ผลคือ
วัดผิดแบบเงียบ ๆ**: JS บอกว่า "พอดี" (`tbody.offsetHeight` ต่ำกว่า budget อยู่ 2px) แต่ตอน render PDF
จริง แถวสุดท้ายกลับวาดทับ footer เห็นได้เฉพาะตอน crop ภาพ PDF ดูใกล้ ๆ เท่านั้น — `pypdf` text
extraction (ที่ใช้เช็คผลตลอดเอกสารนี้) **ตรวจไม่เจอบั๊กนี้เลย** เพราะข้อความยังอยู่ครบ แค่ตำแหน่งวาดทับกัน

**สาเหตุ**: `table{height:100%}` วางอยู่ใน parent ที่เป็น `flex-grow` — `.rp-detail` (parent) ไม่มี
`overflow:hidden` ของตัวเอง (มีแต่ `.a4-page` ชั้นนอกสุดที่ clip ที่ขอบกระดาษจริง) เมื่อตาราง (ลูก) มี
เนื้อหาสูงกว่าที่ `flex-grow` จัดสรรให้ มันวาดทะลุกล่องของตัวเองไปเรื่อย ๆ โดยไม่มีอะไร clip จนถึงขอบ
หน้ากระดาษ ส่วน `tbody.offsetHeight` ที่วัดได้ก็ไม่สะท้อนความสูง "จริง" ที่ตารางใช้วาดอย่างแม่นยำ เพราะ
table layout algorithm ปรับความสูงแถวเมื่อถูกบังคับด้วย `height:100%` ต่างจากตอนปล่อยให้โตตามธรรมชาติ

**วิธีแก้ที่ยืนยันแล้วว่าใช้ได้** — เลิกใช้ `flex-grow` + `height:100%` สำหรับ**การวัด** (ใช้ได้แค่กับ
เลย์เอาต์ที่ hardcode ตายตัวแบบเทมเพลตเดิม) เปลี่ยนเป็น:

```js
// 1. รู้ความสูงที่ flex-grow จัดสรรให้ .rp-detail ก่อน (วัดครั้งเดียวตอนสร้างหน้า ตอนยังไม่มีแถว)
box.style.height = detail.clientHeight + 'px';   // ล็อกเป็น px ตรง ๆ ไม่ใช้ % อีกต่อไป
box.style.overflow = 'hidden';                    // ให้ browser clip เองถ้าเกิน — กันวาดทะลุ

// 2. เช็ค overflow ด้วย scrollHeight vs clientHeight — มาตรฐานและเชื่อถือได้ 100%
function overflow(pg) { return pg.box.scrollHeight > pg.box.clientHeight; }
```

`table` ในกล่องนี้**ไม่ต้องมี** `style="height:100%"` อีกต่อไป — ปล่อยให้โตตามเนื้อหาธรรมชาติ แล้วให้
`.rp-box` (wrapper ใหม่ที่มีแค่ `overflow:hidden` + `height` เป็น px) เป็นคนตัดสินว่าล้นหรือไม่ วิธีนี้
ทดสอบแล้วว่าตัดหน้าถูกต้องครบทุกเคส (1/3/12/24/25/60 รายการ) ไม่มีข้อความทับกันอีก

**ข้อสรุปสำหรับ Phase 2**: `paginator.inline.js` ต้อง **ห้ามใช้ `table{height:100%}` ร่วมกับ
`flex-grow` เพื่อวัดความสูง** เด็ดขาด — ให้ล็อกเป็น px + `overflow:hidden` + เช็คด้วย
`scrollHeight > clientHeight` เท่านั้น และ **ห้าม verify ด้วย text extraction อย่างเดียว** ต้อง render
เป็นภาพ (`pypdfium2`/`pdftoppm`) ดูจริงอย่างน้อยตอน implement เคสแรก เพราะบั๊กแบบนี้ text-based check
มองไม่เห็น

---

## 4. Data model ที่ต้องเปลี่ยน

### 4.1 `print_templates` — คอลัมน์ใหม่

| คอลัมน์ | ชนิด | เหตุผล |
|---|---|---|
| `template_engine` | `varchar(20)` default `'simple'` | `'simple'` = `{{key}}` เดิม (backward compatible), `'banded'` = engine ใหม่ |
| `layout_config` | `jsonb` default `'{}'` | `{ detail_height_mm, reserve_summary_mm, margin_mm: {...}, emulated_media_type }` |
| `emulated_media_type` | `varchar(10)` default `'print'` | override รายเทมเพลต (ดูข้อ 2) — หรือเก็บใน `layout_config` ก็ได้ |

`html_bucket`/`html_path`/`html_hash` **คงเดิมทั้งหมด** — band อยู่ในไฟล์เดียวกัน (ข้อ 3.2)

### 4.2 `IPrintTemplateParameter` — รองรับ array/object

```ts
export type PrintTemplateParameterType =
  | 'string' | 'number' | 'date' | 'boolean' | 'array';

export interface IPrintTemplateParameter {
  key: string;
  label_th: string;
  label_en: string;
  type: PrintTemplateParameterType;   // ← ใหม่ (default 'string' สำหรับแถวเก่า)
  default_value: string | null;
  /** เฉพาะ type='array' — schema ของแต่ละ item เพื่อให้ฟอร์ม admin สร้าง test data ได้ */
  item_schema?: Array<{ key: string; label_th: string; label_en: string; type: PrintTemplateParameterType }>;
}
```

### 4.3 `RenderPrintTemplateDTO` — `params` ต้องรับ nested

```ts
// เดิม: params: Record<string, string>
// ใหม่:
params: Record<string, string | number | boolean | null | Array<Record<string, unknown>>>;
```

⚠️ `substituteParameters()` ปัจจุบัน (`print-templates.service.ts`) ทำ `String.replace` ตรง ๆ ต่อ
`parameterDefs` — **ต้องเขียนใหม่ทั้งหมด** สำหรับ engine `'banded'` แต่ต้องคง path เดิมไว้เมื่อ
`template_engine = 'simple'` ไม่งั้นเทมเพลตที่มีอยู่พังหมด

### 4.4 Migration

- 1 migration ใน `libs/database/src/migrations/erp_report/` — `AddPrintTemplateBandedLayout`
- **generate จาก entity diff เท่านั้น** (`pnpm run migration:generate:report --name=...`) ตาม CLAUDE.md
- คอลัมน์ใหม่ทั้งหมดต้อง **nullable หรือมี default** — ตาราง `print_templates` มีข้อมูลจริงอยู่แล้ว
  (6 แถว ณ 2026-07-29) การเพิ่ม `NOT NULL` เปล่า ๆ จะ fail ทันที (เคยเจอมาแล้วตอนเพิ่ม `html_hash`)
- `template_engine` default `'simple'` → แถวเก่าทั้ง 6 ยังทำงานเหมือนเดิม 100%

---

## 5. โครงไฟล์ที่จะเพิ่ม

```
apps/report-bc/src/modules/print-template/
├── services/
│   ├── print-templates.service.ts          (แก้: แตก render path ตาม template_engine)
│   ├── band-parser.service.ts              (ใหม่: แกะ <template data-band> → band map)
│   └── banded-render.service.ts            (ใหม่: ประกอบ band + data → HTML + inject paginator)
├── assets/
│   └── paginator.inline.js                 (ใหม่: script วัด+หั่นหน้า ฝังเข้า HTML ตอน render)
├── constants/
│   └── print-template-band.constants.ts    (ใหม่: ชื่อ band, ตัวแปรระบบ __page ฯลฯ)
└── interfaces/
    └── band.interface.ts                   (ใหม่)
```

`gotenberg.service.ts` แก้เล็กน้อย: รับ `emulatedMediaType` + `waitForExpression` เป็นพารามิเตอร์
แทนที่จะ hardcode

---

## 6. แผนลงมือ (phases)

### Phase 0 — แก้ regression + ปูทาง (เล็ก, ทำได้ทันที)
1. `emulatedMediaType` → `'print'` และรับเป็นพารามิเตอร์ได้ (ข้อ 2)
2. `waitForExpression` รับเป็นพารามิเตอร์
3. ทดสอบ `PAYMENT_RECEIPT` เดิมว่าไม่ regress หลังสลับ media type

### Phase 1 — ข้อมูลเชิงโครงสร้าง (ยังไม่แบ่งหน้า)
4. entity + migration (ข้อ 4.1, 4.4)
5. `IPrintTemplateParameter.type` + `item_schema` (ข้อ 4.2)
6. `params` รับ array (ข้อ 4.3) + เขียน substitution ใหม่รองรับ `{{item.field}}` ใน loop
7. ฟอร์ม admin: เพิ่ม UI เลือก type + กรอก test array (JSON textarea ก่อนก็พอ)

### Phase 2 — Banded engine (งานหลัก)
8. `band-parser.service.ts` + `banded-render.service.ts`
9. `paginator.inline.js` — วัด/หั่น/filler/เลขหน้า (ข้อ 3.3 ทางเลือก B) — **ใช้ pattern px-box +
   `overflow:hidden` + `scrollHeight>clientHeight` ตามข้อ 3.4 ห้ามใช้ `table{height:100%}` วัด**
10. `template_engine='banded'` เข้า render path ใหม่
11. **แปลง `PAYMENT_RECEIPT` เป็น banded** เป็นเคสทดสอบจริง — ต้องได้ผลตรงรูปตัวอย่าง Makro
    (2 หน้า, header ซ้ำ, detail band ว่างแต่ตีเส้นหน้า 2, summary หน้าสุดท้าย) — **prototype ทำเคสนี้
    สำเร็จแล้ว (ข้อ 3.4)** เอาโค้ด paginator + band-parsing logic จาก prototype มาทำเป็น production
    code ได้เลย ไม่ต้องเริ่มจากศูนย์
12. verify ทุกเคสด้วยการ render PDF เป็นภาพจริง (`pypdfium2` หรือเทียบเท่า) ไม่ใช่แค่ text extraction —
    ดูข้อ 3.4 ว่าทำไม text-based check พลาดบั๊กสำคัญไปได้

### Phase 3 — ขัดเกลา
13. preview ในหน้า admin แสดงตัวแบ่งหน้า + จำนวนหน้า
14. `document_types` ผูก sample payload สำหรับ preview (ตอนนี้ admin ต้องกรอก test data เอง)
15. cache HTML ที่ประกอบแล้วตาม `html_hash` + hash ของ data

---

## 7. ความเสี่ยง / จุดที่ต้องตัดสินใจ

| ความเสี่ยง | ผลกระทบ | แนวทาง |
|---|---|---|
| สลับเป็น `emulatedMediaType=print` ทำเทมเพลตเดิมเพี้ยน | สูง — มี 6 แถวใน production | เก็บเป็น column override รายเทมเพลต, ตั้ง `'screen'` ให้แถวเก่าถ้าจำเป็น |
| `table{height:100%}`+`flex-grow` วัดความสูงผิดแบบเงียบ ๆ (พบจริงตอน prototype) | สูง — ข้อความทับ footer แต่ text-check มองไม่เห็น | **แก้แล้ว** — ดูข้อ 3.4, ใช้ px-box + `overflow:hidden` + `scrollHeight` แทน |
| `paginator.inline.js` เป็นโค้ดที่เราดูแลเอง | กลาง | จำกัด scope ให้แคบ (วัด+หั่น+filler เท่านั้น) + unit test แยกด้วย jsdom + **verify ด้วยภาพ PDF จริง ไม่ใช่แค่ text** |
| เวลา render นานขึ้น (วัดความสูงทุกแถว) | กลาง | เอกสารจริงหลักสิบ–ร้อยแถว ไม่น่าเป็นปัญหา; ตั้ง `--api-timeout` เผื่อ (ตอนนี้ 30s) |
| ฟอนต์ไทยใน Gotenberg header/footer | — | **ไม่ใช้** Gotenberg header/footer เลย — paginator ทำเลขหน้าในหน้าเอกสารเอง (เลี่ยงปัญหานี้ทั้งหมด) |
| `emulatedMediaType` ควรเก็บใน column แยกหรือใน `layout_config` | ต่ำ | เสนอ: column แยก เพราะ `gotenberg.service` ต้องใช้ตรง ๆ ไม่ควรต้องแกะ jsonb |

### คำถามที่ยังต้องเคลียร์ก่อนเริ่ม Phase 2
1. **`template_engine` เป็น enum 2 ค่าพอไหม** — หรือจะรองรับ EJS เต็มรูป (มี `ejs` ใน deps อยู่แล้ว
   และ `apps/report-bc/src/modules/print/templates/invoice.ejs` เป็น precedent) การให้ admin เขียน EJS
   ได้ = flexible สุด แต่ **รันโค้ดที่ admin เขียนบน server = ความเสี่ยงด้านความปลอดภัย** ต้องชั่งใจ
   (ข้อเสนอในเอกสารนี้เลี่ยงด้วยการใช้ band + `{{}}` ที่ไม่ใช่ Turing-complete)
2. หลายเทมเพลตต่อ 1 `document_type` ไหม (ต้นฉบับลูกค้า / สำเนา — รูป Makro มีคำว่า "ต้นฉบับลูกค้า")
   ถ้าต้อง ต้องคิดว่าเป็น template แยก หรือ parameter `copy_type`
3. `detail_height_mm` ตั้งค่าตายตัว หรือให้ paginator คำนวณจาก "พื้นที่ที่เหลือหลังหัก header/footer"

---

## 8. อ้างอิงในโค้ดปัจจุบัน

| ไฟล์ | เกี่ยวข้องอย่างไร |
|---|---|
| `apps/report-bc/src/modules/print/services/gotenberg.service.ts` | จุดแก้ Phase 0 — `emulatedMediaType`, `waitForExpression` |
| `apps/report-bc/src/modules/print-template/entities/print-template.entity.ts` | เพิ่มคอลัมน์ Phase 1 |
| `apps/report-bc/src/modules/print-template/services/print-templates.service.ts` | `substituteParameters()` + `render()` แตก path ตาม engine |
| `apps/report-bc/src/modules/print-template/dto/render-print-template.dto.ts` | `params` รับ nested |
| `apps/report-bc/src/modules/print/templates/invoice.ejs` | precedent ของ EJS + `items.forEach` (แต่ไม่มี pagination) |
| `apps/iam/views/pages/print-templates/form.ejs` | ฟอร์ม admin — เพิ่ม UI parameter type / test array |
| `libs/database/src/migrations/erp_report/` | ที่อยู่ migration ใหม่ |

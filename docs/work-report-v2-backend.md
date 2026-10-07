# Work Report v2 — Backend Changes (Roman Urdu)

> **Status: IMPLEMENT HO CHUKA HAI (2026-10-07).** Asal rules ab `CLAUDE.md` §6 aur §7a mein hain — wahi follow karo.
> Is plan se farq: `sharp` use **nahi** hua — compression Cloudinary ki upload-time (incoming) transformation karti hai
> (1200px, WebP, auto quality). Multer `diskStorage` → `os.tmpdir()` → Cloudinary → temp file delete.
> Image sub-doc fields: `url` + `publicId` (`key` nahi). Storage adapter ki jagah seedha `utils/cloudinary.js`.

> **AI agent / Copilot ke liye:** Ye document batata hai backend mein KYA banana hai, code nahi deta.
> Kaam shuru karne se pehle repo root ki `CLAUDE.md` zaroor parho — naming, response shape, dates (DD/MM/YYYY),
> soft delete aur validation ke rules wahan hain. Is document ki koi baat `CLAUDE.md` se takraye to
> **is document ki baat sirf Work Report feature ke liye** maano, baaki sab `CLAUDE.md` ke mutabiq.
>
> Frontend ka matching document: `D:\hassan2\Haroon-Marble-Admin-Panel\docs\work-report-v2-frontend.md`

---

## 0. Abhi kya chal raha hai (current flow)

| Step | Abhi kya hota hai | Backend |
|---|---|---|
| 1 | Admin "Work Title" + "Site" select karke Work Report banata hai | `POST /create-work-order` → `WorkOrder` |
| 2 | View → "Add Work Report" → Work Start Date, Work Ready Date, Sent to Client Date | `POST /create-sample-round` → `SampleRound` |
| 3 | History table mein "Record response" → Client Response Date, Approved/Rejected, Notes | `PUT /update-sample-round/:id` |
| 4 | PDF download | Frontend `html2canvas` + `jsPDF` (backend ka koi role nahi) |

Masla: beech mein aane wali **site problems** (photo + wajah + kitne din ruka) ka koi record nahi hai.

## 1. Naya flow (target)

```
[1] Work Report banao        (Title + Site + Client name)            -> WorkOrder
        |
[2] Kaam Shuru karo          (Start date, optional note)             -> SampleRound (Round 1)
        |
[3] Problem report karo      (date + wajah + kis ki wajah se + photos) -> SiteIssue  (0..bohot saari, baar baar)
    Problem hal ho gayi      (hal hone ki date + note)               -> SiteIssue update
        |
[4] Kaam Mukammal            (completion date)                       -> SampleRound update
        |
[5] Client ka jawab          (date + Approved / Rejected + notes)    -> SampleRound update
        |
   Rejected?  --> "Dobara kaam (Rework)" = naya Round (Round 2), phir step [2] se
   Approved?  --> Work Report final. PDF / slip download.
```

**Ahem faisle (decisions):**
- `SampleRound` collection ka **naam aur fields NAHI badlenge** (production data maujood hai, migration ka risk nahi lena).
  Sirf unka matlab (meaning) naya hai — neeche mapping table dekho. UI mein "Round" ko "Kaam ka Round / Attempt" kahenge.
- Problems ke liye **naya model `SiteIssue`** banega. Har issue ek `WorkOrder` aur ek `SampleRound` se linked hoga.
- WorkOrder ka `status` **khud-ba-khud (automatic)** badlega, admin manually nahi chunega (sirf "Cancel" manual).

### Field mapping — SampleRound (purane naam, naya matlab)

| DB field (same rahega) | Naya matlab | UI label |
|---|---|---|
| `roundNumber` | Kaam ka attempt number | "Round #1", "Rework #2" |
| `sampleStartDate` | Site par kaam shuru hone ki date | "Kaam Shuru Date" |
| `description` | Shuru karte waqt note (optional) | "Note" |
| `sampleReadyDate` | Kaam mukammal hone ki date | "Kaam Mukammal Date" |
| `sentToClientDate` | (optional, purana) client ko dikhane ki date | UI mein hide, DB mein rehne do |
| `clientResponseDate` | Client ne jawab kis din diya | "Client Jawab Date" |
| `responseStatus` | `pending` / `approved` / `rejected` | "Intezar" / "Approved" / "Rejected" |
| `rejectionNotes` | Reject ki wajah | "Reject ki wajah" |

---

## 2. ⚠️ Sabse pehle: Image kahan save hongi? (Hosting problem)

Ye backend **Vercel serverless** par deploy hai (`vercel.json`, `server.js`). Vercel par:

1. **Disk read-only hai** — `uploads/images/` mein file likhne par error aayega (sirf `/tmp` likh sakte ho, aur wo bhi har request/restart par mit jata hai).
   Matlab "local `uploads/images/` folder + `express.static`" wala plan **Vercel par kaam NAHI karega**.
2. **Request body limit ~4.5 MB hai** — "10MB per file x 5 files" Vercel par possible hi nahi. Request server tak pohanchne se pehle reject ho jayegi (413 error).

### Hal (recommended architecture): "Storage Adapter"

Image processing (multer + sharp) ek jagah, aur image **save/delete** karne ka kaam ek alag chhoti file mein jiske do "driver" hon:

| Driver | Kab use karo | Image kahan jayegi | DB mein kya save hoga |
|---|---|---|---|
| `cloudinary` (**recommended, abhi ke liye**) | Backend Vercel par hai | Cloudinary (free tier kaafi hai) | `url` (Cloudinary ka https URL) + `key` (Cloudinary `public_id`) |
| `local` | Backend kabhi VPS / persistent disk par shift ho | `uploads/images/<file>.webp` | `url` = relative path `/uploads/images/<file>.webp` + `key` = filename |

- Env var `IMAGE_STORAGE_DRIVER` = `cloudinary` ya `local`. Controller ko kabhi pata nahi hona chahiye ke image kahan gayi — wo sirf adapter ke 2 functions call kare: **"save image buffer"** aur **"delete image by key"**.
- Is tarah aaj Cloudinary, kal VPS — sirf env var badlega, controller/model nahi.
- Alternative (agar Cloudinary nahi chahiye): Cloudflare R2 / AWS S3 / Vercel Blob — same adapter pattern, teesra driver.
- **Owner se confirm karo** kaunsa driver use karna hai. Default: `cloudinary`.

> Relative path wala rule (poora domain DB mein save mat karo) **sirf `local` driver** ke liye hai, kyunki wahan domain aapka backend hai jo badal sakta hai.
> Cloudinary/R2 mein `key` (public_id) asal cheez hai; URL hamesha `key` se dobara banaya ja sakta hai.

---

## 3. Packages

| Package | Kyun | Note |
|---|---|---|
| `multer` | `multipart/form-data` (files) receive karna | **Pehle se installed hai** (`middleware/multer.js` maujood hai lekin kahin use nahi hota) |
| `sharp` | Resize + WebP + compress | Naya install. Vercel par chal jata hai (Linux binary khud aati hai) |
| `cloudinary` | Sirf agar `cloudinary` driver chuna | Naya install |

Koi aur package add mat karo (`CLAUDE.md` §11). `uuid` ki zaroorat nahi — Node ka built-in `crypto.randomUUID()` / `crypto.randomBytes` kaafi hai.

### Naye env vars (`.env` mein, aur `CLAUDE.md` §10 ki list mein bhi add karo)

| Var | Example | Kab chahiye |
|---|---|---|
| `IMAGE_STORAGE_DRIVER` | `cloudinary` | Hamesha |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | — | `cloudinary` driver |
| `CLOUDINARY_FOLDER` | `haroon-marble/site-issues` | optional |

Server start par agar driver `cloudinary` hai aur keys missing hain to **saaf error log karo** (silent fail nahi).

---

## 4. Naya Model: `SiteIssue`

File: `models/site-issue-model.js` — model name `SiteIssue`. Baaki models jaisa style (`CLAUDE.md` §6).

| Field | Type | Rules | Matlab |
|---|---|---|---|
| `workOrderId` | ObjectId ref `WorkOrder` | required, index | Kis Work Report ki problem |
| `roundId` | ObjectId ref `SampleRound` | required, index | Kis round (attempt) ke dauran |
| `issueDate` | Date | required | Problem kis din aayi (DD/MM/YYYY se parse) |
| `description` | String | required, trim | Wajah / kya problem thi |
| `causedBy` | String enum | `client`, `company`, `material`, `weather`, `other`; default `other` | Kis ki wajah se — client ko proof dene ke liye sabse ahem field |
| `images` | Array of sub-docs | max 5 | Har item: `url` (String), `key` (String), `_id` (auto). Sub-doc `_id` se hi specific image delete hogi |
| `resolvedDate` | Date | default `null` | Problem kab hal hui. `null` = abhi jari (open) |
| `resolutionNote` | String | trim, default `""` | Kaise hal hui |
| `deleted_at` | Date | default `null`, index | Soft delete |
| timestamps | | `created_at` / `updated_at` | |

Indexes: `{ workOrderId: 1, issueDate: 1 }`.

**Store mat karo (calculate karo):** `status` (open/resolved) aur `delayDays` — ye `resolvedDate` se nikalte hain (`CLAUDE.md` mein FactoryWork virtuals wala pattern). Response mein inhe add karo:
- `isResolved` = `resolvedDate` hai ya nahi
- `delayDays` = `issueDate` se `resolvedDate` tak din. Agar abhi open hai to aaj tak ke din, aur `isResolved: false`.
- Din ginne ke liye `utils/work-order-service.js` ka `daysBetween` dobara use karo (naya mat likho).

---

## 5. Image Processing Pipeline

Nayi files (suggested):
- `utils/image-processing.js` — sharp wala pure kaam (buffer in → webp buffer out)
- `utils/image-storage.js` — storage adapter (save / delete), driver env se
- `middleware/multer.js` — **update** karo (neeche dekho)

### 5.1 Multer (`middleware/multer.js` update)
- `memoryStorage()` hi rakho (pehle se hai). `diskStorage` bilkul nahi.
- **File filter sirf mime-type se:** `image/jpeg`, `image/png`, `image/webp` (`image/heic` iPhone ke liye — sirf tab allow karo jab test kar lo ke sharp HEIC parh raha hai; warna frontend browser mein convert kare).
  Abhi wala filter PDF/Excel bhi allow karta hai aur "mime-type **YA** extension" check karta hai — ye galat hai, sirf extension badal kar koi bhi file bhej sakta hai. Images ke liye naya, strict filter banao.
- Limits: `fileSize` per file — `local` driver par 10MB theek hai, **Vercel par effectively 4MB total request** hai, is liye frontend pehle hi compress karke bhejega (frontend doc §5). `files: 5`.
- Field name: **`images`** — `.array("images", 5)`. Frontend bhi exact `images` naam use karega. Naam mismatch par multer chup-chaap `req.files` khali de deta hai.
- Agar `multer.js` ka purana generic `upload` kahin aur use karna ho to alag export rakho; images ke liye alag `uploadImages` export behtar hai.

### 5.2 Sharp — har image ke liye (parallel, `Promise.all`)
1. `rotate()` — **pehle ye** (mobile photos EXIF orientation se ulti/terchi aati hain; ye step na ho to photo 90° ghoomi hui dikhegi). Sharp metadata (GPS location waghaira) bhi hata deta hai — privacy ke liye acha.
2. Resize: width max **1200px**, height mat do, `withoutEnlargement: true`.
3. WebP quality loop: 75 → 65 → 55 → 45 → 40 (floor). Target ~**50KB**; 40 par bhi zyada ho to wahi accept (target hai, hard limit nahi).
4. Filename: server khud banaye — `<timestamp>-<random>.webp`. Original filename kabhi kisi path/naam mein use mat karo.
5. Agar sharp error de (corrupt / fake image) → **400** "Image file kharab hai ya support nahi hoti (sirf JPG/PNG/WEBP)".

### 5.3 Atomic rule (sab ya kuch nahi)
1. **Pehle saari images memory mein process karo** (sharp). Ek bhi fail → 400, kuch bhi save nahi hua.
2. Phir saari images storage par save karo (parallel). Agar ek bhi save fail → jo save ho chuki unhe delete karo → 500.
3. Phir DB record create/update karo. DB fail → jo images save hui unhe delete karo.
Is tarah kabhi "aadhi images" ya "bina record ki images" nahi banengi.

---

## 6. API Endpoints

Sab naye routes **`authMiddleware` ke peeche** (`CLAUDE.md` §8). Image upload public rakhna = koi bhi aapka storage bhar sakta hai.
Naye routes file: `routes/site-issue-route.js`, mount `app.use("/api/v1", ...)`. Controller: `controllers/site-issue-controller.js`.
Response shape `CLAUDE.md` §4 wala: `{ success, message, data }`. Saari dates DD/MM/YYYY mein aayengi aur jayengi.

### 6.1 `POST /create-site-issue` — `multipart/form-data`
Text fields: `workOrderId`, `roundId`, `issueDate` (DD/MM/YYYY, khali = aaj), `description`, `causedBy`. Files: `images` (0–5).
Validation (sab 400 ke sath saaf message):
- `workOrderId`, `roundId` valid ObjectId; WorkOrder maujood aur deleted nahi; round isi WorkOrder ka ho aur deleted nahi.
- Round **active** ho: start ho chuka (`sampleStartDate` hai) aur client response abhi `pending` ho. Approved/Rejected round par naya issue nahi.
- `description` required. `causedBy` enum mein ho.
- `issueDate` round ki start date se pehle na ho, aur aaj se aage (future) na ho.
- Note: multipart mein sab fields **string** aati hain — numbers/booleans khud convert karo.
Response: 201, `data` = naya issue (formatted dates + `isResolved` + `delayDays`).

### 6.2 `PUT /update-site-issue/:issueId` — `multipart/form-data`
- Text fields optional: `issueDate`, `description`, `causedBy`, `resolvedDate`, `resolutionNote`.
- Nayi files: `images` (purani + nayi mila kar **5 se zyada nahi**).
- Image hatani ho to: `removeImageIds` — image sub-doc `_id` ki list (JSON string array, ya same field kai baar). "Purana vs naya array diff" ki zaroorat nahi — frontend saaf batayega kaunsi hatani hai.
- `resolvedDate` = "Problem hal ho gayi". `issueDate` se pehle nahi ho sakti. Khali string bheji to `null` (dobara open).
- **Order (zaroori):** pehle nayi images process+save → phir DB update (nayi add, hatayi gayi nikal do) → **DB update kamyab hone ke BAAD** hatayi gayi images storage se delete.
  Wajah: agar file pehle delete ki aur DB update fail hua to record ek toote (broken) image ko point karega — user ko nazar aane wala bug. Ulta case (DB update ho gaya, file delete fail) mein sirf ek bekaar file reh jati hai jo baad mein cleanup ho sakti hai — log mein `console.error` karo.

### 6.3 `DELETE /delete-site-issue/:issueId` — soft delete
- `deleted_at = new Date()` (codebase ka rule: business data hard-delete nahi hota).
- **Images delete NAHI karni** — ye client ke sath jhagre (dispute) mein saboot (proof) hain. Soft-deleted issue ki images rehne do.
- (Future) Agar storage bharne lage to ek alag cleanup script `scripts/` mein: jo issues 6+ mahine pehle soft-delete hue unki images delete. Abhi zaroorat nahi.

### 6.4 Issues alag GET endpoint nahi — `get-single-work-order` mein aayenge
`GET /get-single-work-order/:workOrderId` (`utils/work-order-service.js` → `getWorkOrderTimeline`) ka response barhao:
- `rounds[]` — har round ke andar `issues[]` (us round ke non-deleted issues, `issueDate` ascending), har issue mein `isResolved`, `delayDays`, `images[]`.
- `stats` mein naye fields:

| Stat | Formula |
|---|---|
| `totalRounds` | (pehle se) |
| `rejectedCount` | (pehle se) |
| `totalIssues` | saare non-deleted issues |
| `openIssues` | jinka `resolvedDate` null |
| `totalIssueDelayDays` | saare issues ke `delayDays` ka jor (overlap ko ignore — simple rakho, PDF par likh do "approx") |
| `clientCausedDelayDays` | sirf `causedBy = client` wale issues ke din |
| `workDays` | current/aakhri round: start → mukammal date (ya aaj tak agar jari) |
| `totalDurationDays` | pehle round ki start date → approval date (ya aaj) |

Purane stats `daysInSamplePhase` / `daysApprovalToStart` / `daysInProgress` naye flow mein confusing hain — **frontend un par depend karta hai** (`daysInSamplePhase` card), is liye response se foran mat hatao; frontend update hone ke baad hatao.

---

## 7. Round (SampleRound) aur WorkOrder status ke naye rules

Endpoints **wahi rahenge** (`/create-sample-round`, `/update-sample-round/:id`) — sirf andar ka logic badlega.

### 7.1 Status flow (WorkOrder.status — DB values same, sirf ek nayi value add)

| Event | Status (DB value) | UI label |
|---|---|---|
| Work Report bana | `pending_sample` | "Shuru nahi hua" |
| Round start hua (`sampleStartDate` set) | `in_progress` | "Kaam jari hai" |
| Round mukammal (`sampleReadyDate` set) | `in_review` | "Client ke jawab ka intezar" |
| Client ne approve kiya | `approved` | "Approved ✓" (final) |
| Client ne reject kiya | **`rework_required`** (naya enum value — add karo) | "Dobara kaam chahiye" |
| Rework round start | `in_progress` | |
| Admin ne cancel kiya (manual) | `cancelled` | "Cancelled" |
| `completed` | purana value — naye flow mein auto set nahi hoga, purane records ke liye enum mein rehne do | "Mukammal" |

- Enum mein `rework_required` add karna backward-compatible hai (purana data kharab nahi hoga).
- "Open problem" koi status **nahi** hai — frontend `openIssues > 0` dekh kar "⚠ Problem jari" badge dikhayega.
- Status ko `updateWorkOrder` se manually set karna band karo, **sirf `cancelled`** allow ho. Baaki status upar wale events se khud set hon.
- `updateWorkOrder` ka purana rule "workStartDate aaye aur status approved ho to in_progress" — naye flow ke against hai, hata do.

### 7.2 Round rules
- **Ek waqt mein ek hi active round.** Naya round sirf tab ban sakta hai jab: koi round na ho, ya aakhri round `rejected` ho. Warna 400 "Pehle wala round abhi khatam nahi hua".
- `roundNumber` = (is WorkOrder ke **saare** rounds, deleted samait, ka max roundNumber) + 1. Abhi `count + 1` hai jo soft-delete ke baad duplicate number deta hai. `{ workOrderId, roundNumber }` par unique index lagao.
- Dates ki tarteeb (validation, 400): start ≤ mukammal ≤ client jawab. Mukammal date ke baghair client response record nahi ho sakta.
- `responseStatus = rejected` ho to `rejectionNotes` required.
- Approved round ko dobara edit (response change) mat karne do — ya kam az kam WorkOrder status ko peeche (approved → in_review) mat le jao. (Abhi wala bug: purane round ko approve karne se `in_progress`/`completed` order wapas `approved` ho jata hai.)
- Round update + WorkOrder status update dono collections mein likhte hain — `mongoose.startSession()` transaction use karo (`CLAUDE.md` §6).

### 7.3 Isi kaam ke sath ye related bugs bhi theek karo
- `controllers/work-order-controller.js` mein `Site` import missing hai — search par 500 aata hai.
- `createWorkOrder`: `siteId` ko ObjectId + maujood site check karo; `clientName` aur `description` save karo (abhi ignore ho rahe hain). `clientName` khali ho to Site ka `ownerName` default le lo.
- `createSampleRound` frontend se `workStartDate` naam bhi accept karta hai — naye frontend mein sirf `sampleStartDate` bhejo, backend dono accept karta rahe (purane clients ke liye).

---

## 8. `server.js` changes
1. Naya `site-issue` router mount (`/api/v1`).
2. **Global error middleware** (saare routes ke BAAD, `(err, req, res, next)`):
   - `MulterError` `LIMIT_FILE_SIZE` → 400 "Har photo zyada se zyada X MB ki ho"
   - `LIMIT_FILE_COUNT` / `LIMIT_UNEXPECTED_FILE` → 400 "Zyada se zyada 5 photos" (ye tab bhi aata hai jab field name `images` na ho)
   - fileFilter wala error → 400 "Sirf JPG, PNG, WEBP photos allowed hain"
   - Baaki → 500 `{ success: false, message: "Server error" }`, aur `console.error`
   Raw technical message frontend ko mat bhejo.
3. Sirf `local` driver ke liye: `uploads/images/` folder server start par khud banao (agar nahi hai), aur `/uploads` static route **par CORS** lagao (PDF ke liye zaroori — §9).
   Abhi `server.js` mein `/uploads` → `public/uploads` (jo folder hai hi nahi) — local driver lagate waqt isko theek karo; cloudinary driver par ye route ki zaroorat nahi.
4. `local` driver ke liye `.gitignore` mein `uploads/images/*` aur `!uploads/images/.gitkeep`.

## 9. CORS aur PDF
PDF `html2canvas` se banti hai jo image ka pixel data parhta hai. Image ke response mein `Access-Control-Allow-Origin` header na ho to canvas "tainted" ho jata hai aur PDF mein image blank/kaali aati hai.
- **Cloudinary**: header khud bhejta hai — backend par kuch nahi karna.
- **Local**: `/uploads` static route par `cors` middleware (allowed origin = `FRONTEND_LIVE_URL`).
Frontend ko bhi `crossOrigin="anonymous"` lagana hai (frontend doc).

## 10. Kya NAHI karna (Don'ts)
- `diskStorage`, original filename, poora backend domain DB mein (local driver), images ka hard-delete jab issue delete ho.
- `SampleRound` / `WorkOrder` ke field rename ya collection rename.
- Naye routes bina `authMiddleware`.
- `new Date("DD/MM/YYYY")` — hamesha `utils/date-helper-fun.js`.
- Controller ke andar seedha Cloudinary/fs call — hamesha `utils/image-storage.js` ke through.
- Response shape mein naye top-level keys (`issue`, `issues`) — hamesha `data`.

## 11. Kaam ki tarteeb (implementation order)
1. Packages + env vars + `utils/image-storage.js` (driver) + `utils/image-processing.js`
2. `middleware/multer.js` (images ke liye strict) + `server.js` error middleware
3. `SiteIssue` model → controller → route (auth ke sath) → mount
4. `WorkOrder` enum mein `rework_required`; round + status rules (§7); related bugs (§7.3)
5. `getWorkOrderTimeline` mein issues + naye stats
6. Neeche wali testing checklist
7. `CLAUDE.md` update: naya model, naye env vars, image upload rules

## 12. Testing checklist
- [ ] 200KB photo → WebP bani, size aur kam, quality theek
- [ ] 4–5MB mobile photo (frontend compress ke baad) → final ~50KB ke aas paas
- [ ] 50x50 chhoti image → bari nahi hui (`withoutEnlargement`)
- [ ] `.txt` ko `.jpg` naam de kar → 400 saaf message, server crash nahi
- [ ] Ek sath 3–4 photos → sab save, DB `images` array mein sab
- [ ] 6 photos → 400 "zyada se zyada 5"
- [ ] Mobile se khinchi tasveer seedhi dikh rahi hai (ghoomi hui nahi) — `rotate()` check
- [ ] Update mein 1 photo hatai → sirf wahi storage se gayi, baaki safe
- [ ] Issue delete → record soft-delete, photos storage mein **maujood**
- [ ] Bina token ke `create-site-issue` → 401
- [ ] Round approve hone ke baad naya issue → 400
- [ ] Reject → status `rework_required`; naya round → `in_progress`, roundNumber sahi
- [ ] Do rounds active karne ki koshish → 400
- [ ] `get-single-work-order` mein `rounds[].issues[]` aur naye `stats`
- [ ] Image URL browser mein khulta hai; PDF mein image nazar aati hai (blank nahi)

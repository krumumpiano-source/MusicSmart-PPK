# อัปเดต Google Apps Script (GAS) ให้ตรงกับแอป — คู่มือครู

> สถานะ: **เตรียมไว้เท่านั้น ยังไม่ได้ deploy อะไรเลย** — ระบบจะไม่แตะ Apps Script จริงจนกว่าคุณจะทำตามขั้นตอนด้านล่างและกดสั่งเอง

## 1. แอปแจ้งเตือนอย่างไรเมื่อ GAS ไม่ตรงกับแอป
- ไฟล์ `google_apps_script.js` มีค่า `GAS_VERSION` (เช่น `2026.10.28-1`) และตอบกลับค่านี้ใน action `ping`
- แอปรู้ว่าตัวเองต้องการเวอร์ชันไหน (อ่านจากเทมเพลตที่ฝังในแอป ซึ่งซิงค์จากไฟล์เดียวกัน)
- ครูเปิด **หน้าต่างซิงค์ Google Sheet** (หรือกดทดสอบการเชื่อมต่อ) → แอปเทียบเวอร์ชันให้เอง
  - ตรง → "Apps Script เป็นเวอร์ชันล่าสุด"
  - ไม่ตรงหรือ GAS เก่ามากจนไม่รายงานเวอร์ชัน → ป้ายหัวแอปขึ้น **⚠️ ต้องอัปเดต GAS** พร้อมข้อความบอกเวอร์ชันที่มีอยู่/ที่ต้องการ
- หมายเหตุ: GAS ที่ deploy อยู่ตอนนี้ยังเป็นโค้ดเก่า (ยังไม่รายงานเวอร์ชัน) จึงจะขึ้น "ต้องอัปเดต GAS" จนกว่าจะ deploy โค้ดล่าสุด — เป็นพฤติกรรมที่ถูกต้อง

## 2. วิธีอัปเดตด้วยมือ (ใช้ได้เลย ไม่ต้องตั้งค่าอะไรเพิ่ม)
1. เปิดหน้าต่างซิงค์ในแอป → กดคัดลอกโค้ด Apps Script (ปุ่ม 1-Click Copy)
2. เปิดโปรเจกต์ Apps Script เดิม → วางทับโค้ดทั้งหมด → บันทึก
3. Deploy → **Manage deployments** → แก้ไข (ไอคอนดินสอ) → Version: **New version** → Deploy
   (ใช้ deployment เดิม URL `/exec` จะไม่เปลี่ยน; **ห้ามกด New deployment** เพราะ URL จะเปลี่ยน)
4. เปิดหน้าต่างซิงค์ในแอปอีกครั้ง ป้ายต้องไม่ขึ้น "ต้องอัปเดต GAS"
5. `SYNC_TOKEN` อยู่ใน Script Properties บน Google — การวางโค้ดไม่ทำให้หาย

## 3. อัปเดตอัตโนมัติด้วย GitHub Actions + clasp (ตัวเลือก ทำครั้งเดียว)
ไฟล์เทมเพลต: `.github/workflows/gas_deploy.yml.template` (GitHub **ไม่รัน**ไฟล์นามสกุล `.template`)

ทำครั้งเดียว:
1. ติดตั้ง Node.js ในเครื่องที่คุณใช้งาน แล้วรัน `npm i -g @google/clasp@2` และ `clasp login` (ล็อกอินบัญชี Google ที่เป็นเจ้าของโปรเจกต์ Apps Script)
   - เปิด **Apps Script API** ที่ https://script.google.com/home/usersettings
2. หา **Script ID** (Project Settings ใน Apps Script) และ **Deployment ID** ของ Web app เดิม (Deploy → Manage deployments)
3. ดึง manifest เดิมมาไว้ในโปรเจกต์ เพื่อไม่ให้สิทธิ์/ค่า Web app เปลี่ยน:
   `clasp clone <Script ID> --rootDir gas_tmp` แล้วคัดลอก `gas_tmp/appsscript.json` ไปเป็น `gas/appsscript.json` ในโปรเจกต์นี้ (แล้วลบโฟลเดอร์ `gas_tmp`)
   — ตรวจให้แน่ใจว่าในไฟล์เป็น `"webapp": {"executeAs": "USER_DEPLOYING", "access": "ANYONE"}` ตามที่ใช้อยู่จริง
4. ใน GitHub → Settings → Secrets and variables → Actions → New repository secret สร้าง 3 ตัว:
   - `GAS_SCRIPT_ID` = Script ID
   - `GAS_DEPLOYMENT_ID` = Deployment ID เดิม
   - `CLASPRC_JSON` = เนื้อทั้งไฟล์ `~/.clasprc.json` (บน Windows: `%USERPROFILE%\.clasprc.json`) — **เป็นความลับเทียบเท่ารหัสผ่าน ห้ามส่งใครหรือคอมมิต**
5. เปลี่ยนชื่อ `.github/workflows/gas_deploy.yml.template` → `gas_deploy.yml` แล้ว push

ใช้งาน (ทุกครั้งที่แก้ `google_apps_script.js`):
1. แก้ `GAS_VERSION` ในไฟล์ให้เป็นค่าใหม่ แล้วรัน `python tools/sync_apps_script_template.py`
2. push ขึ้น GitHub (ขั้นตอน deploy เว็บแอปปกติไม่แตะ GAS)
3. GitHub → Actions → **Deploy Google Apps Script (manual)** → Run workflow → พิมพ์ `DEPLOY` → Run
4. เปิดหน้าต่างซิงค์ในแอปเพื่อยืนยันว่าเวอร์ชันตรงแล้ว

ความปลอดภัย: workflow รันเฉพาะเมื่อกดเองและพิมพ์ยืนยัน · ไม่พิมพ์ secret ลง log · ลบไฟล์รับรองออกจาก runner ทุกครั้ง · ไม่แตะ Script Properties (SYNC_TOKEN) · ถ้า secret หรือ `gas/appsscript.json` ไม่ครบจะหยุดก่อน push
ถ้าต้องการยกเลิกสิทธิ์: https://myaccount.google.com/permissions (ลบสิทธิ์ clasp) และลบ secret ใน GitHub

## 4. ข้อควรจำ
- ถ้าไม่ตั้งค่า auto-deploy ก็ใช้วิธีข้อ 2 ได้ตลอด ผลเหมือนกัน
- ทุกครั้งที่แก้ `google_apps_script.js` ต้องเปลี่ยน `GAS_VERSION` + รัน sync (ชุดทดสอบจะเตือนถ้าลืม sync; ส่วนลืมเปลี่ยนเลขเวอร์ชัน ให้ดูตัวช่วยใน `tests/test_gas_version_check.js`)

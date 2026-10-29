# ตั้งค่าบัญชีครูครั้งแรกบน Cloudflare (ทำครั้งเดียว)
# - ถามอีเมล ชื่อ และรหัสผ่านแบบซ่อนตัวอักษร (ไม่บันทึกลงไฟล์หรือแชต)
# - ใช้ SETUP_TOKEN จากไฟล์ที่ระบบสร้างไว้ให้ (%TEMP%\ms_setup_token.txt) หรือกรอกเอง
# รัน: powershell -ExecutionPolicy Bypass -File scripts\setup-teacher.ps1

$ErrorActionPreference = 'Stop'
$api = 'https://musicsmart-api.krumum-piano.workers.dev'

$email = Read-Host 'อีเมลครู (เช่น krumum.piano@gmail.com)'
$name = Read-Host 'ชื่อที่แสดง (เช่น นายพงศธร โพธิแก้ว)'
$secure = Read-Host 'ตั้งรหัสผ่านใหม่ (อย่างน้อย 12 ตัวอักษร, จะไม่แสดงบนหน้าจอ)' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

$tokenFile = Join-Path $env:TEMP 'ms_setup_token.txt'
if (Test-Path $tokenFile) {
  $setupToken = (Get-Content $tokenFile -Raw).Trim()
} else {
  $setupToken = Read-Host 'กรอก SETUP_TOKEN'
}

$body = @{ email = $email; name = $name; password = $password; setupToken = $setupToken } | ConvertTo-Json -Compress
try {
  # ส่งเป็น UTF-8 เสมอ เพื่อไม่ให้ภาษาไทยเพี้ยนเป็น ? (PowerShell 5.1 ใช้ค่าเริ่มต้นเป็น Latin-1)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
  $r = Invoke-RestMethod -Uri "$api/api/auth/setup" -Method Post -ContentType 'application/json; charset=utf-8' -Body $bytes
  Write-Host 'สำเร็จ: ตั้งค่าบัญชีครูแล้ว' -ForegroundColor Green
  Remove-Item $tokenFile -ErrorAction SilentlyContinue
  Write-Host 'ลบไฟล์ SETUP_TOKEN ชั่วคราวแล้ว'
} catch {
  $status = $_.Exception.Response.StatusCode.value__
  Write-Host "ไม่สำเร็จ (HTTP $status) ตรวจอีเมล/รหัสผ่านที่ตั้ง หรือบัญชีถูกตั้งค่าไปแล้ว" -ForegroundColor Red
} finally {
  $password = $null
  $body = $null
}

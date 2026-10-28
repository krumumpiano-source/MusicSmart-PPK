#!/usr/bin/env node
/* build_legacy.js — แปลงไวยากรณ์ JS ใหม่ (?. ?? async/await object-spread ฯลฯ) ให้เบราว์เซอร์/WebView เก่าอ่านได้
 * ทำเฉพาะใน "สำเนาที่จะ deploy" (_site) — ไม่แตะซอร์สใน app/  ·  เทสต์ในเครื่องยังรันกับซอร์สจริงตามเดิม
 *
 * ใช้:  node tools/build/build_legacy.js _site [--target=chrome51,firefox60]
 * ต้องมี: npm i --no-save esbuild acorn   (ใน CI ติดตั้งให้ใน deploy.yml)
 * ตรวจหลังแปลง: parse ด้วย acorn (ES2016) ทุกไฟล์ — ถ้ายังมีไวยากรณ์ใหม่หลงเหลือ จะ exit 1 */
'use strict';
const fs = require('fs'), path = require('path');
const site = path.resolve(process.argv[2] || '_site');
const tArg = (process.argv.find(a => a.indexOf('--target=') === 0) || '').slice(9);
const targets = (tArg || 'chrome51,firefox60').split(',');
let esbuild, acorn;
try { esbuild = require('esbuild'); acorn = require('acorn'); } catch (e) { console.error('ต้องติดตั้ง: npm i --no-save esbuild acorn'); process.exit(2); }
const dirs = ['js', 'data'];
const files = [];
dirs.forEach(d => { const p = path.join(site, d); if (fs.existsSync(p)) fs.readdirSync(p).filter(f => /\.js$/.test(f)).forEach(f => files.push(path.join(p, f))); });
if (fs.existsSync(path.join(site, 'sw.js'))) files.push(path.join(site, 'sw.js'));
let bad = 0, before = 0, after = 0;
files.forEach(f => {
  const src = fs.readFileSync(f, 'utf8');
  if (/legacy-polyfills\.js$/.test(f)) { try { acorn.parse(src, { ecmaVersion: 5 }); } catch (e) { bad++; console.error('✗ polyfills ไม่ใช่ ES5: ' + e.message); } return; }
  let out;
  try { out = esbuild.transformSync(src, { target: targets, charset: 'utf8', legalComments: 'none', sourcefile: path.basename(f) }).code; }
  catch (e) { bad++; console.error('✗ แปลงไม่ได้ ' + path.relative(site, f) + ': ' + String(e.message).split('\n').slice(0, 3).join(' | ')); return; }
  try { acorn.parse(out, { ecmaVersion: 2016, allowHashBang: true, allowReturnOutsideFunction: true }); }
  catch (e) { bad++; console.error('✗ หลังแปลงยังมีไวยากรณ์ใหม่ ' + path.relative(site, f) + ': ' + e.message); return; }
  before += src.length; after += out.length;
  fs.writeFileSync(f, out);
});
console.log((bad ? '✗' : '✓') + ' แปลง ' + files.length + ' ไฟล์ → target ' + targets.join(',') + ' (' + before + ' → ' + after + ' ไบต์)' + (bad ? ' · ผิดพลาด ' + bad : ''));
process.exit(bad ? 1 : 0);

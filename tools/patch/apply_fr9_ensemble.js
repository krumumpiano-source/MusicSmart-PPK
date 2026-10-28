#!/usr/bin/env node
/* fr9: เพิ่มชื่ออังกฤษ (en) + วิธีเล่น (how/howBySynth) ให้เครื่องดนตรีใน ensemble_source.json — idempotent */
'use strict';
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, '..', 'curriculum', 'ensemble_source.json');
const s = JSON.parse(fs.readFileSync(F, 'utf8'));
const EN = {
  ranat_ek: 'Ranat ek (high-pitched wooden xylophone)', ranat_thum: 'Ranat thum (low-pitched wooden xylophone)',
  khong_wong_yai: 'Khong wong yai (large circle of gongs)', khong_wong_lek: 'Khong wong lek (small circle of gongs)',
  pi_nai: 'Pi nai (quadruple-reed oboe)', ching: 'Ching (small cup cymbals)', taphoon: 'Taphon (barrel drum)',
  klong_that: 'Klong that (pair of large drums)', saw_duang: 'Saw duang (high-pitched two-string fiddle)',
  saw_u: 'Saw u (low-pitched two-string fiddle)', jakhe: 'Jakhe (floor zither, crocodile zither)',
  khlui_phiang_aw: 'Khlui phiang aw (medium vertical flute)', thon_rammana: 'Thon-rammana (goblet drum and frame drum)',
  ranat_ek_mahori: 'Ranat ek (small mahori xylophone)', saw_sam_sai: 'Saw sam sai (three-string fiddle)',
  khlui: 'Khlui phiang aw / lip (vertical flute)', khong_mahori: 'Khong wong (mahori gong circle)',
  salor: 'Salo (northern Thai bowed lute)', seung: 'Sueng (northern Thai plucked lute)', pi_jum: 'Pi chum (northern Thai reed pipe)',
  klong_teungnong: 'Klong tueng nong (northern Thai drum)', ponglang_inst: 'Pong lang (hanging wooden xylophone)',
  phin: 'Phin (Isan plucked lute)', khene: 'Khaen (free-reed mouth organ)', wot: 'Wot (Isan panpipe)', hai_song: 'Hai song (southern Thai instrument)',
  first_violin: 'Violin 1 (Concertmaster)', second_violin: 'Violin 2', viola: 'Viola', cello: 'Cello', double_bass: 'Double bass',
  woodwinds: 'Woodwinds (flute, oboe, clarinet, bassoon)', brass: 'Brass (horn, trumpet, trombone, tuba)',
  timpani: 'Timpani & percussion', conductor: 'Conductor', sq_v1: 'Violin 1', sq_v2: 'Violin 2', sq_va: 'Viola', sq_vc: 'Cello',
  klong_yao: 'Klong yao (long drum)', ching_folk: 'Ching (small cup cymbals)', chap: 'Chap (large cymbals)', krap: 'Krap (wooden clappers)',
  mhong: 'Mong (small gong)', violin_rong: 'Violin', ramana_s: 'Rammana (frame drum)', khong_s: 'Khong (gong)',
  flute_cl: 'Flute / clarinet', sax: 'Saxophone', trumpet: 'Trumpet', trombone: 'Trombone', tuba_euph: 'Tuba / euphonium',
  snare_bass: 'Snare drum / bass drum', piano: 'Piano', drum_set: 'Drum set', upright_bass: 'Double bass',
  e_guitar: 'Electric guitar', bass_guitar: 'Bass guitar', keyboard: 'Keyboard', vocal: 'Vocal'
};
// วิธีเล่นเฉพาะเครื่อง (ถ้าไม่มี ใช้ howBySynth)
const HOW = {
  ranat_ek: 'ถือไม้ตี 2 อัน ตีที่ลูกระนาด', ranat_thum: 'ถือไม้ตี 2 อัน ตีที่ลูกระนาด', ranat_ek_mahori: 'ถือไม้ตี 2 อัน ตีที่ลูกระนาด',
  khong_wong_yai: 'นั่งกลางวงฆ้อง ตีที่ปุ่มฆ้องด้วยไม้ตี 2 อัน', khong_wong_lek: 'นั่งกลางวงฆ้อง ตีที่ปุ่มฆ้องด้วยไม้ตี 2 อัน', khong_mahori: 'นั่งกลางวงฆ้อง ตีที่ปุ่มฆ้องด้วยไม้ตี 2 อัน',
  pi_nai: 'เป่าลมผ่านลิ้นปี่ (ลิ้นคู่) ใช้นิ้วปิด-เปิดรู',
  ching: 'ตีสองข้างกระทบกัน (เปิด = ฉิ่ง ปิด = ฉับ)', ching_folk: 'ตีสองข้างกระทบกัน (เปิด = ฉิ่ง ปิด = ฉับ)',
  taphoon: 'ใช้มือตีที่หน้ากลองทั้งสองด้าน', klong_that: 'ใช้ไม้ตีที่หน้ากลอง', thon_rammana: 'ใช้มือตีที่หน้ากลอง',
  saw_duang: 'สีด้วยคันชักที่สอดอยู่ระหว่างสายทั้งสอง', saw_u: 'สีด้วยคันชักที่สอดอยู่ระหว่างสายทั้งสอง', saw_sam_sai: 'สีด้วยคันชัก กดสายด้วยนิ้ว',
  salor: 'สีด้วยคันชัก กดสายด้วยนิ้ว', jakhe: 'วางราบกับพื้น ดีดสายด้วยไม้ดีด (ปิ๊ก) และกดสายด้วยนิ้ว',
  seung: 'ดีดสายด้วยปิ๊กหรือนิ้ว กดสายตามเฟร็ต', phin: 'ดีดสายด้วยนิ้วหรือปิ๊ก กดสายตามเฟร็ต',
  khlui_phiang_aw: 'เป่าลมข้ามปากขลุ่ย ปิด-เปิดรูด้วยนิ้ว', khlui: 'เป่าลมข้ามปากขลุ่ย ปิด-เปิดรูด้วยนิ้ว',
  pi_jum: 'เป่าลมผ่านลิ้นปี่ ปิด-เปิดรูด้วยนิ้ว', khene: 'เป่าลมเข้าไปในเต้าแคน ปิดรูที่ลูกแคนด้วยนิ้วเพื่อให้เสียงดัง',
  wot: 'เป่าลมข้ามปากท่อไม้ไผ่ ถือด้วยมือหรือวางบนไม้', ponglang_inst: 'ใช้ไม้ตี 2 อันตีที่ลูกโปงลางที่แขวนไว้',
  klong_teungnong: 'ใช้มือหรือไม้ตีที่หน้ากลอง', krap: 'ถือไม้สองท่อนตีกระทบกัน', chap: 'ถือฉาบสองข้าง ตีกระทบกัน',
  mhong: 'แขวนไว้ ใช้ไม้ตีที่ปุ่มฆ้อง', klong_yao: 'สะพายและตีด้วยมือที่หน้ากลอง', ramana_s: 'ถือด้วยมือหนึ่ง ตีด้วยอีกมือ', khong_s: 'แขวนไว้ ใช้ไม้ตีที่ปุ่มฆ้อง',
  hai_song: 'ตามที่ครูผู้สอนกำหนด (ข้อมูลวิธีเล่นรอครูเพิ่มเติม)',
  first_violin: 'สีด้วยคันชัก กดสายด้วยนิ้วมือซ้าย', second_violin: 'สีด้วยคันชัก กดสายด้วยนิ้วมือซ้าย', viola: 'สีด้วยคันชัก กดสายด้วยนิ้วมือซ้าย',
  sq_v1: 'สีด้วยคันชัก กดสายด้วยนิ้วมือซ้าย', sq_v2: 'สีด้วยคันชัก กดสายด้วยนิ้วมือซ้าย', sq_va: 'สีด้วยคันชัก กดสายด้วยนิ้วมือซ้าย', violin_rong: 'สีด้วยคันชัก กดสายด้วยนิ้วมือซ้าย',
  cello: 'นั่งเล่น วางเครื่องระหว่างเข่า สีด้วยคันชัก', sq_vc: 'นั่งเล่น วางเครื่องระหว่างเข่า สีด้วยคันชัก',
  double_bass: 'ยืนหรือนั่งเก้าอี้สูง สีด้วยคันชักหรือดีดสาย', upright_bass: 'ยืนหรือนั่งเก้าอี้สูง ดีดสาย (หรือสีด้วยคันชัก)',
  woodwinds: 'เป่าลม — ฟลูตเป่าข้ามปากเครื่อง ส่วนโอโบ คลาริเน็ต บาสซูนใช้ลิ้น (reed) กดคีย์เปลี่ยนเสียง',
  flute_cl: 'เป่าลม — ฟลูตเป่าข้ามปากเครื่อง คลาริเน็ตใช้ลิ้นเดี่ยว กดคีย์เปลี่ยนเสียง', sax: 'เป่าลมผ่านลิ้นเดี่ยว กดคีย์เปลี่ยนเสียง',
  brass: 'เป่าลมให้ริมฝีปากสั่นในเมาท์พีซ กดลูกสูบ/เลื่อนสไลด์เปลี่ยนเสียง', trumpet: 'เป่าลมให้ริมฝีปากสั่นในเมาท์พีซ กดลูกสูบเปลี่ยนเสียง',
  trombone: 'เป่าลมให้ริมฝีปากสั่นในเมาท์พีซ เลื่อนสไลด์เปลี่ยนเสียง', tuba_euph: 'เป่าลมให้ริมฝีปากสั่นในเมาท์พีซ กดลูกสูบเปลี่ยนเสียง',
  timpani: 'ใช้ไม้ตีหน้ากลอง (ทิมปานีปรับระดับเสียงได้ด้วยแป้นเท้า)', snare_bass: 'ใช้ไม้ตีหน้ากลอง (แสนร์) หรือไม้กระทุ้งกลองใหญ่ (เบส)', drum_set: 'ใช้ไม้ตีกลองชุดและฉาบ เท้าเหยียบกระเดื่องและไฮแฮต',
  conductor: 'ไม่ได้เล่นเครื่องดนตรี — ใช้มือ/ไม้บาตงให้สัญญาณจังหวะ ความเร็ว และความดัง-เบา',
  piano: 'กดคีย์ (ลิ่มนิ้ว) ด้วยนิ้วมือทั้งสองข้าง ค้อนภายในตีสาย', keyboard: 'กดคีย์ (ลิ่มนิ้ว) ด้วยนิ้วมือ เสียงมาจากวงจรอิเล็กทรอนิกส์',
  e_guitar: 'ดีดหรือรูดสายด้วยปิ๊กหรือนิ้ว กดสายตามเฟร็ต เสียงขยายผ่านแอมป์', bass_guitar: 'ดีดสายด้วยนิ้วหรือปิ๊ก กดสายตามเฟร็ต เสียงขยายผ่านแอมป์',
  vocal: 'ใช้เสียงร้อง (ไม่ใช่เครื่องดนตรี) ควบคุมลมหายใจและเสียง'
};
s.howBySynth = {
  struck: 'ใช้ไม้หรือมือตีให้เกิดเสียง', struck_drum: 'ใช้มือหรือไม้ตีที่หน้ากลอง', bell: 'ตีหรือกระทบให้เกิดเสียง',
  blown: 'เป่าลมให้เกิดเสียง', bowed: 'ใช้คันชักสีสาย', plucked: 'ดีดสายให้เกิดเสียง', brass: 'เป่าลมให้ริมฝีปากสั่นในเมาท์พีซ', generic: 'ดูรายละเอียดในแหล่งเรียนรู้ที่ครูกำหนด'
};
let n = 0;
Object.keys(s.instruments).forEach(k => {
  const i = s.instruments[k];
  if (!EN[k]) throw new Error('missing en for ' + k);
  if (!HOW[k]) throw new Error('missing how for ' + k);
  if (i.en !== EN[k] || i.how !== HOW[k]) n++;
  i.en = EN[k]; i.how = HOW[k];
});
fs.writeFileSync(F, JSON.stringify(s, null, 1) + '\n');
console.log('instruments updated:', n, 'of', Object.keys(s.instruments).length);

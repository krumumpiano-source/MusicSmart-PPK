/* GENERATED FILE — do not edit. Source: tools/curriculum/ensemble_source.json */
(function (root) {
  var ENSEMBLE_DATA = {
    "_generated": "สร้างโดย tools/curriculum/build_ensemble_data.js — ห้ามแก้ไฟล์นี้ด้วยมือ; แก้ที่ ensemble_source.json แล้วรันใหม่",
    "version": 1,
    "reviewLabel": "ร่างโดยระบบ – รอครูตรวจ",
    "reviewNote": "ชื่อวง ภาค และประเภทเครื่องดนตรีอ้างอิง วก.5 คาบ 12 และ 14 ส่วนรายละเอียดอื่น (ยุค โอกาสใช้ บทบาท ผังที่นั่ง) ระบบเขียนเป็นร่าง ครูตรวจก่อนใช้สอน — ตั้ง \"review\": false ต่อวงที่ตรวจแล้ว",
    "classSets": {
     "thai": [
      "ตี",
      "เป่า",
      "ดีด",
      "สี"
     ],
     "western": [
      "สาย",
      "ลมไม้",
      "ทองเหลือง",
      "ลิ่มนิ้ว",
      "กระทบ"
     ]
    },
    "regions": [
     "ภาคเหนือ (ล้านนา)",
     "ภาคตะวันออกเฉียงเหนือ (อีสาน)",
     "ภาคกลาง",
     "ภาคใต้"
    ],
    "synthPresets": {
     "struck": {
      "wave": "triangle",
      "freq": 659.25,
      "attack": 0.005,
      "decay": 0.35,
      "peak": 0.7
     },
     "struck_drum": {
      "wave": "sine",
      "freq": 164.8,
      "attack": 0.005,
      "decay": 0.5,
      "peak": 0.8
     },
     "bowed": {
      "wave": "sawtooth",
      "freq": 440,
      "attack": 0.1,
      "decay": 1.2,
      "peak": 0.4
     },
     "blown": {
      "wave": "sine",
      "freq": 523.25,
      "attack": 0.15,
      "decay": 1.4,
      "peak": 0.5
     },
     "plucked": {
      "wave": "triangle",
      "freq": 392,
      "attack": 0.005,
      "decay": 0.8,
      "peak": 0.6
     },
     "brass": {
      "wave": "square",
      "freq": 233.1,
      "attack": 0.08,
      "decay": 0.9,
      "peak": 0.25
     },
     "bell": {
      "wave": "sine",
      "freq": 2093,
      "attack": 0.003,
      "decay": 0.9,
      "peak": 0.8
     },
     "generic": {
      "wave": "sine",
      "freq": 329.63,
      "attack": 0.005,
      "decay": 0.5,
      "peak": 0.5
     }
    },
    "instruments": {
     "ranat_ek": {
      "name": "ระนาดเอก",
      "cls": "ตี",
      "detail": "เครื่องตี",
      "tone": "เสียงแหลมสดใส คมชัด ดำเนินทำนองหลักและแปรทำนอง",
      "synth": "struck",
      "review": true,
      "en": "Ranat ek (high-pitched wooden xylophone)",
      "how": "ถือไม้ตี 2 อัน ตีที่ลูกระนาด",
      "audio": {
       "file": "media/m1/p12/audio/ranat_ek_scale.mp3",
       "original": "media/m1/p12/audio/ranat_ek_scale.ogg",
       "label": "เสียงระนาดเอกจริง: บันไดเสียงไทย 7 เสียง (ประมาณ 7 วินาที)",
       "title": "Thai classical music scale.ogg",
       "license": "CC BY-SA 3.0",
       "author": "Paul_012",
       "page": "https://commons.wikimedia.org/wiki/File:Thai_classical_music_scale.ogg",
       "source": "Wikimedia Commons",
       "change": "แปลงรูปแบบ ogg → mp3 เพื่อให้เล่นได้บน iPhone/Safari — ไม่ได้ตัดต่อเนื้อเสียง",
       "period": 12
      }
     },
     "ranat_thum": {
      "name": "ระนาดทุ้ม",
      "cls": "ตี",
      "detail": "เครื่องตี",
      "tone": "เสียงทุ้มนุ่ม ล้อเลียนขัดจังหวะทำนองหลัก",
      "synth": "struck",
      "review": true,
      "en": "Ranat thum (low-pitched wooden xylophone)",
      "how": "ถือไม้ตี 2 อัน ตีที่ลูกระนาด"
     },
     "khong_wong_yai": {
      "name": "ฆ้องวงใหญ่",
      "cls": "ตี",
      "detail": "เครื่องตี",
      "tone": "เสียงกังวานทุ้ม เป็นแก่นและโครงสร้างทำนองที่เครื่องอื่นต้องยึดถือ",
      "synth": "struck",
      "review": true,
      "en": "Khong wong yai (large circle of gongs)",
      "how": "นั่งกลางวงฆ้อง ตีที่ปุ่มฆ้องด้วยไม้ตี 2 อัน"
     },
     "khong_wong_lek": {
      "name": "ฆ้องวงเล็ก",
      "cls": "ตี",
      "detail": "เครื่องตี",
      "tone": "เสียงแหลมเล็ก ลวดลายพริ้วไหว สอดประสานเสียงสูง",
      "synth": "struck",
      "review": true,
      "en": "Khong wong lek (small circle of gongs)",
      "how": "นั่งกลางวงฆ้อง ตีที่ปุ่มฆ้องด้วยไม้ตี 2 อัน"
     },
     "pi_nai": {
      "name": "ปี่ใน",
      "cls": "เป่า",
      "detail": "เครื่องเป่า",
      "tone": "เสียงแหลมโหยหวน มีพลัง ลมหายใจหมุนเวียน (ระบายลม)",
      "synth": "blown",
      "review": true,
      "en": "Pi nai (quadruple-reed oboe)",
      "how": "เป่าลมผ่านลิ้นปี่ (ลิ้นคู่) ใช้นิ้วปิด-เปิดรู"
     },
     "ching": {
      "name": "ฉิ่ง",
      "cls": "ตี",
      "detail": "เครื่องประกอบจังหวะ",
      "tone": "เสียง ฉิ่ง (เปิด) และ ฉับ (ปิด) ควบคุมอัตราจังหวะ ช้า-ปานกลาง-เร็ว",
      "synth": "bell",
      "review": true,
      "en": "Ching (small cup cymbals)",
      "how": "ตีสองข้างกระทบกัน (เปิด = ฉิ่ง ปิด = ฉับ)"
     },
     "taphoon": {
      "name": "ตะโพนไทย",
      "cls": "ตี",
      "detail": "เครื่องหนัง",
      "tone": "เสียงทุ้มกังวานและเสียงหนักแน่น เป็นครูใหญ่แห่งเครื่องจังหวะ",
      "synth": "struck",
      "review": true,
      "en": "Taphon (barrel drum)",
      "how": "ใช้มือตีที่หน้ากลองทั้งสองด้าน"
     },
     "klong_that": {
      "name": "กลองทัด (คู่)",
      "cls": "ตี",
      "detail": "เครื่องหนัง",
      "tone": "เสียง ตูม (ตัวผู้) และ ต้อม (ตัวเมีย) ตีขานรับเพิ่มความฮึกเหิม",
      "synth": "struck",
      "review": true,
      "en": "Klong that (pair of large drums)",
      "how": "ใช้ไม้ตีที่หน้ากลอง"
     },
     "saw_duang": {
      "name": "ซอด้วง",
      "cls": "สี",
      "detail": "เครื่องสี",
      "tone": "เสียงแหลมหวาน คมชัด ดำเนินทำนองนำของเครื่องสาย",
      "synth": "bowed",
      "review": true,
      "en": "Saw duang (high-pitched two-string fiddle)",
      "how": "สีด้วยคันชักที่สอดอยู่ระหว่างสายทั้งสอง"
     },
     "saw_u": {
      "name": "ซออู้",
      "cls": "สี",
      "detail": "เครื่องสี",
      "tone": "เสียงทุ้มลึก นุ่มนวล เคล้าคลอไปกับซอด้วง",
      "synth": "bowed",
      "review": true,
      "en": "Saw u (low-pitched two-string fiddle)",
      "how": "สีด้วยคันชักที่สอดอยู่ระหว่างสายทั้งสอง"
     },
     "jakhe": {
      "name": "จะเข้",
      "cls": "ดีด",
      "detail": "เครื่องดีด",
      "tone": "เสียงกังวานใส รัวนิ้วและสะบัดเสียงได้คล่องแคล่ว",
      "synth": "plucked",
      "review": true,
      "en": "Jakhe (floor zither, crocodile zither)",
      "how": "วางราบกับพื้น ดีดสายด้วยไม้ดีด (ปิ๊ก) และกดสายด้วยนิ้ว"
     },
     "khlui_phiang_aw": {
      "name": "ขลุ่ยเพียงออ",
      "cls": "เป่า",
      "detail": "เครื่องเป่า",
      "tone": "เสียงโหยหวน นุ่มนวล สอดประสานคลอเคล้าเสียงร้อง",
      "synth": "blown",
      "review": true,
      "en": "Khlui phiang aw (medium vertical flute)",
      "how": "เป่าลมข้ามปากขลุ่ย ปิด-เปิดรูด้วยนิ้ว"
     },
     "thon_rammana": {
      "name": "โทน-รำมะนา",
      "cls": "ตี",
      "detail": "เครื่องหนัง",
      "tone": "โทนให้เสียงป้อง รำมะนาให้เสียงปิ๊ง สอดประสานเข้ากัน",
      "synth": "struck",
      "review": true,
      "en": "Thon-rammana (goblet drum and frame drum)",
      "how": "ใช้มือตีที่หน้ากลอง"
     },
     "ranat_ek_mahori": {
      "name": "ระนาดเอกมโหรี (ย่อส่วน)",
      "cls": "ตี",
      "detail": "เครื่องตี",
      "tone": "เสียงหวานใส ไม่ดังเกินเครื่องสาย",
      "synth": "struck",
      "review": true,
      "en": "Ranat ek (small mahori xylophone)",
      "how": "ถือไม้ตี 2 อัน ตีที่ลูกระนาด"
     },
     "saw_sam_sai": {
      "name": "ซอสามสาย",
      "cls": "สี",
      "detail": "เครื่องสี",
      "tone": "เสียงหวานซึ้ง ละเมียดละไม เป็นประธานแห่งวงมโหรี",
      "synth": "bowed",
      "review": true,
      "en": "Saw sam sai (three-string fiddle)",
      "how": "สีด้วยคันชัก กดสายด้วยนิ้ว"
     },
     "khlui": {
      "name": "ขลุ่ยเพียงออ/หลิบ",
      "cls": "เป่า",
      "detail": "เครื่องเป่า",
      "tone": "โหยหวนเชื่อมเสียงร้อง",
      "synth": "blown",
      "review": true,
      "en": "Khlui phiang aw / lip (vertical flute)",
      "how": "เป่าลมข้ามปากขลุ่ย ปิด-เปิดรูด้วยนิ้ว"
     },
     "khong_mahori": {
      "name": "ฆ้องวงมโหรี",
      "cls": "ตี",
      "detail": "เครื่องตี",
      "tone": "ขนาดเล็กกว่าฆ้องวงไทยเดิม ให้เสียงหวาน",
      "synth": "struck",
      "review": true,
      "en": "Khong wong (mahori gong circle)",
      "how": "นั่งกลางวงฆ้อง ตีที่ปุ่มฆ้องด้วยไม้ตี 2 อัน"
     },
     "salor": {
      "name": "สะล้อ (เล็ก/ใหญ่)",
      "cls": "สี",
      "detail": "เครื่องสีพื้นบ้าน",
      "tone": "เสียงหวานโหยหวน ลากคันชักพริ้วไหว",
      "synth": "bowed",
      "review": true,
      "en": "Salo (northern Thai bowed lute)",
      "how": "สีด้วยคันชัก กดสายด้วยนิ้ว"
     },
     "seung": {
      "name": "ซึง (กลาง/หลวง)",
      "cls": "ดีด",
      "detail": "เครื่องดีดพื้นบ้าน",
      "tone": "เสียงดีดกังวาน นุ่มนวล เคาะจังหวะนิ้วเป็นเอกลักษณ์",
      "synth": "plucked",
      "review": true,
      "en": "Sueng (northern Thai plucked lute)",
      "how": "ดีดสายด้วยปิ๊กหรือนิ้ว กดสายตามเฟร็ต"
     },
     "pi_jum": {
      "name": "ปี่จุม (ปี่ก้อย/แม่)",
      "cls": "เป่า",
      "detail": "เครื่องเป่า (ชนิดลิ้นต้องให้ครูยืนยัน)",
      "tone": "เสียงโอดครวญ นุ่มนวล เข้ากับบทขับซอล้านนา",
      "synth": "blown",
      "review": true,
      "en": "Pi chum (northern Thai reed pipe)",
      "how": "เป่าลมผ่านลิ้นปี่ ปิด-เปิดรูด้วยนิ้ว"
     },
     "klong_teungnong": {
      "name": "กลองเต่งถิ้ง",
      "cls": "ตี",
      "detail": "เครื่องหนัง",
      "tone": "เสียงทุ้มแน่น คุมจังหวะช้าเนิบนาบสไตล์ล้านนา",
      "synth": "struck",
      "review": true,
      "en": "Klong tueng nong (northern Thai drum)",
      "how": "ใช้มือหรือไม้ตีที่หน้ากลอง"
     },
     "ponglang_inst": {
      "name": "โปงลาง",
      "cls": "ตี",
      "detail": "เครื่องตีไม้",
      "tone": "เสียงคม แข็ง ใส แขวนเล่น 2 คน (คนตีทำนอง + คนตีลูกเสพ)",
      "synth": "struck",
      "review": true,
      "en": "Pong lang (hanging wooden xylophone)",
      "how": "ใช้ไม้ตี 2 อันตีที่ลูกโปงลางที่แขวนไว้"
     },
     "phin": {
      "name": "พิณอีสาน (2-3 สาย)",
      "cls": "ดีด",
      "detail": "เครื่องดีด",
      "tone": "เสียงหวานใส รัวนิ้วเร็วเร้าใจ ลายเต้ย ลายภูไท",
      "synth": "plucked",
      "review": true,
      "en": "Phin (Isan plucked lute)",
      "how": "ดีดสายด้วยนิ้วหรือปิ๊ก กดสายตามเฟร็ต"
     },
     "khene": {
      "name": "แคน",
      "cls": "เป่า",
      "detail": "เครื่องเป่าลิ้นโลหะ",
      "tone": "มีเสียงประสานคอร์ดในตัว พลังเสียงพริ้วต่อเนื่องไม่ขาดสาย",
      "synth": "blown",
      "review": true,
      "en": "Khaen (free-reed mouth organ)",
      "how": "เป่าลมเข้าไปในเต้าแคน ปิดรูที่ลูกแคนด้วยนิ้วเพื่อให้เสียงดัง"
     },
     "wot": {
      "name": "โหวด",
      "cls": "เป่า",
      "detail": "เครื่องเป่า",
      "tone": "เสียงหมุนเหวี่ยงสูง คล้ายเสียงนกบินร่อนบนท้องฟ้า",
      "synth": "blown",
      "review": true,
      "en": "Wot (Isan panpipe)",
      "how": "เป่าลมข้ามปากท่อไม้ไผ่ ถือด้วยมือหรือวางบนไม้"
     },
     "hai_song": {
      "name": "ไหซอง",
      "cls": "ดีด",
      "detail": "เครื่องดีดสายยาง",
      "tone": "ดึงสายยางปากไห ให้เสียงเบสทุ้มต่ำและท่าฟ้อนรำสวยงาม",
      "synth": "plucked",
      "review": true,
      "en": "Hai song (southern Thai instrument)",
      "how": "ตามที่ครูผู้สอนกำหนด (ข้อมูลวิธีเล่นรอครูเพิ่มเติม)"
     },
     "first_violin": {
      "name": "Violin 1 (Concertmaster)",
      "cls": "สาย",
      "detail": "Strings (เครื่องสาย)",
      "tone": "เสียงสูงสดใส พริ้วไหว กังวาน",
      "synth": "bowed",
      "review": true,
      "en": "Violin 1 (Concertmaster)",
      "how": "สีด้วยคันชัก กดสายด้วยนิ้วมือซ้าย"
     },
     "second_violin": {
      "name": "Violin 2",
      "cls": "สาย",
      "detail": "Strings",
      "tone": "สอดประสานกับ Violin 1",
      "synth": "bowed",
      "review": true,
      "en": "Violin 2",
      "how": "สีด้วยคันชัก กดสายด้วยนิ้วมือซ้าย"
     },
     "viola": {
      "name": "Viola",
      "cls": "สาย",
      "detail": "Strings",
      "tone": "เสียงอุ่น หนา นุ่ม เป็นสะพานเชื่อมเสียงสูงกับต่ำ",
      "synth": "bowed",
      "review": true,
      "en": "Viola",
      "how": "สีด้วยคันชัก กดสายด้วยนิ้วมือซ้าย"
     },
     "cello": {
      "name": "Cello",
      "cls": "สาย",
      "detail": "Strings",
      "tone": "เสียงทุ้มลึก มีพลัง สื่ออารมณ์ซาบซึ้ง",
      "synth": "bowed",
      "review": true,
      "en": "Cello",
      "how": "นั่งเล่น วางเครื่องระหว่างเข่า สีด้วยคันชัก"
     },
     "double_bass": {
      "name": "Double Bass",
      "cls": "สาย",
      "detail": "Strings",
      "tone": "เสียงทุ้มต่ำ หนักแน่น ยึดโครงสร้างฮาร์โมนี",
      "synth": "bowed",
      "review": true,
      "en": "Double bass",
      "how": "ยืนหรือนั่งเก้าอี้สูง สีด้วยคันชักหรือดีดสาย"
     },
     "woodwinds": {
      "name": "Woodwinds (Flute/Oboe/Clarinet/Bassoon)",
      "cls": "ลมไม้",
      "detail": "Woodwinds (เครื่องลมไม้)",
      "tone": "เสียงนุ่มนวล มีเอกลักษณ์เฉพาะตัวสูง",
      "synth": "blown",
      "review": true,
      "en": "Woodwinds (flute, oboe, clarinet, bassoon)",
      "how": "เป่าลม — ฟลูตเป่าข้ามปากเครื่อง ส่วนโอโบ คลาริเน็ต บาสซูนใช้ลิ้น (reed) กดคีย์เปลี่ยนเสียง"
     },
     "brass": {
      "name": "Brass (Horn/Trumpet/Trombone/Tuba)",
      "cls": "ทองเหลือง",
      "detail": "Brass (เครื่องลมทองเหลือง)",
      "tone": "เสียงดังก้องกังวาน สง่างาม",
      "synth": "generic",
      "review": true,
      "en": "Brass (horn, trumpet, trombone, tuba)",
      "how": "เป่าลมให้ริมฝีปากสั่นในเมาท์พีซ กดลูกสูบ/เลื่อนสไลด์เปลี่ยนเสียง"
     },
     "timpani": {
      "name": "Timpani & Percussion",
      "cls": "กระทบ",
      "detail": "Percussion (เครื่องกระทบ)",
      "tone": "เสียงทุ้มกึกก้อง กำหนดจุดไคลแมกซ์ของบทเพลง",
      "synth": "generic",
      "review": true,
      "en": "Timpani & percussion",
      "how": "ใช้ไม้ตีหน้ากลอง (ทิมปานีปรับระดับเสียงได้ด้วยแป้นเท้า)"
     },
     "conductor": {
      "name": "Conductor (วาทยกร)",
      "cls": "ผู้อำนวยเพลง",
      "detail": "Leadership",
      "tone": "ใช้ไม้บาตองสื่อสารอารมณ์และคิวการเข้าเล่น",
      "synth": "generic",
      "review": true,
      "en": "Conductor",
      "how": "ไม่ได้เล่นเครื่องดนตรี — ใช้มือ/ไม้บาตงให้สัญญาณจังหวะ ความเร็ว และความดัง-เบา"
     },
     "sq_v1": {
      "name": "Violin 1",
      "cls": "สาย",
      "detail": "Strings",
      "tone": "เสียงสูงสดใส ชวนคุย",
      "synth": "bowed",
      "review": true,
      "en": "Violin 1",
      "how": "สีด้วยคันชัก กดสายด้วยนิ้วมือซ้าย"
     },
     "sq_v2": {
      "name": "Violin 2",
      "cls": "สาย",
      "detail": "Strings",
      "tone": "ช่วยเติมเต็มฮาร์โมนี",
      "synth": "bowed",
      "review": true,
      "en": "Violin 2",
      "how": "สีด้วยคันชัก กดสายด้วยนิ้วมือซ้าย"
     },
     "sq_va": {
      "name": "Viola",
      "cls": "สาย",
      "detail": "Strings",
      "tone": "เสียงทุ้มกลางลึกซึ้ง",
      "synth": "bowed",
      "review": true,
      "en": "Viola",
      "how": "สีด้วยคันชัก กดสายด้วยนิ้วมือซ้าย"
     },
     "sq_vc": {
      "name": "Cello",
      "cls": "สาย",
      "detail": "Strings",
      "tone": "เสียงเบสทุ้มกังวานรองรับทุกคน",
      "synth": "bowed",
      "review": true,
      "en": "Cello",
      "how": "นั่งเล่น วางเครื่องระหว่างเข่า สีด้วยคันชัก"
     },
     "klong_yao": {
      "name": "กลองยาว",
      "cls": "ตี",
      "detail": "เครื่องตี",
      "tone": "เสียงกลองทุ้มสนุก ใช้ตีให้จังหวะหลัก",
      "synth": "struck_drum",
      "review": true,
      "en": "Klong yao (long drum)",
      "how": "สะพายและตีด้วยมือที่หน้ากลอง"
     },
     "ching_folk": {
      "name": "ฉิ่ง",
      "cls": "ตี",
      "detail": "เครื่องตี",
      "tone": "เสียงแหลมใสกำกับจังหวะ",
      "synth": "bell",
      "review": true,
      "en": "Ching (small cup cymbals)",
      "how": "ตีสองข้างกระทบกัน (เปิด = ฉิ่ง ปิด = ฉับ)"
     },
     "chap": {
      "name": "ฉาบ",
      "cls": "ตี",
      "detail": "เครื่องตี",
      "tone": "เสียงกังวานแหลมสำหรับเน้นจังหวะ",
      "synth": "bell",
      "review": true,
      "en": "Chap (large cymbals)",
      "how": "ถือฉาบสองข้าง ตีกระทบกัน"
     },
     "krap": {
      "name": "กรับ",
      "cls": "ตี",
      "detail": "เครื่องตี",
      "tone": "เสียงไม้กระทบกันเป็นจังหวะ",
      "synth": "struck",
      "review": true,
      "en": "Krap (wooden clappers)",
      "how": "ถือไม้สองท่อนตีกระทบกัน"
     },
     "mhong": {
      "name": "โหม่ง",
      "cls": "ตี",
      "detail": "เครื่องตี",
      "tone": "เสียงฆ้องทุ้มกังวาน",
      "synth": "struck_drum",
      "review": true,
      "en": "Mong (small gong)",
      "how": "แขวนไว้ ใช้ไม้ตีที่ปุ่มฆ้อง"
     },
     "violin_rong": {
      "name": "ไวโอลิน",
      "cls": "สี",
      "detail": "เครื่องสี",
      "tone": "เสียงสีนำทำนอง",
      "synth": "bowed",
      "review": true,
      "en": "Violin",
      "how": "สีด้วยคันชัก กดสายด้วยนิ้วมือซ้าย"
     },
     "ramana_s": {
      "name": "รำมะนา",
      "cls": "ตี",
      "detail": "เครื่องตี",
      "tone": "เสียงกลองหน้าเดียวให้จังหวะ",
      "synth": "struck_drum",
      "review": true,
      "en": "Rammana (frame drum)",
      "how": "ถือด้วยมือหนึ่ง ตีด้วยอีกมือ"
     },
     "khong_s": {
      "name": "ฆ้อง",
      "cls": "ตี",
      "detail": "เครื่องตี",
      "tone": "เสียงฆ้องกังวานกำกับจังหวะ",
      "synth": "struck_drum",
      "review": true,
      "en": "Khong (gong)",
      "how": "แขวนไว้ ใช้ไม้ตีที่ปุ่มฆ้อง"
     },
     "flute_cl": {
      "name": "Flute / Clarinet",
      "cls": "ลมไม้",
      "detail": "ลมไม้",
      "tone": "เสียงลมไม้ใสนุ่ม",
      "synth": "blown",
      "review": true,
      "en": "Flute / clarinet",
      "how": "เป่าลม — ฟลูตเป่าข้ามปากเครื่อง คลาริเน็ตใช้ลิ้นเดี่ยว กดคีย์เปลี่ยนเสียง"
     },
     "sax": {
      "name": "Saxophone",
      "cls": "ลมไม้",
      "detail": "ลมไม้",
      "tone": "เสียงอุ่น ร้องเพลงได้",
      "synth": "blown",
      "review": true,
      "en": "Saxophone",
      "how": "เป่าลมผ่านลิ้นเดี่ยว กดคีย์เปลี่ยนเสียง"
     },
     "trumpet": {
      "name": "Trumpet",
      "cls": "ทองเหลือง",
      "detail": "ทองเหลือง",
      "tone": "เสียงสว่างแหลมคม",
      "synth": "brass",
      "review": true,
      "en": "Trumpet",
      "how": "เป่าลมให้ริมฝีปากสั่นในเมาท์พีซ กดลูกสูบเปลี่ยนเสียง"
     },
     "trombone": {
      "name": "Trombone",
      "cls": "ทองเหลือง",
      "detail": "ทองเหลือง",
      "tone": "เสียงทองเหลืองทุ้มนุ่ม",
      "synth": "brass",
      "review": true,
      "en": "Trombone",
      "how": "เป่าลมให้ริมฝีปากสั่นในเมาท์พีซ เลื่อนสไลด์เปลี่ยนเสียง"
     },
     "tuba_euph": {
      "name": "Tuba / Euphonium",
      "cls": "ทองเหลือง",
      "detail": "ทองเหลือง",
      "tone": "เสียงทองเหลืองต่ำ",
      "synth": "brass",
      "review": true,
      "en": "Tuba / euphonium",
      "how": "เป่าลมให้ริมฝีปากสั่นในเมาท์พีซ กดลูกสูบเปลี่ยนเสียง"
     },
     "snare_bass": {
      "name": "Snare / Bass Drum",
      "cls": "กระทบ",
      "detail": "กระทบ",
      "tone": "เสียงกลองกำกับจังหวะ",
      "synth": "struck_drum",
      "review": true,
      "en": "Snare drum / bass drum",
      "how": "ใช้ไม้ตีหน้ากลอง (แสนร์) หรือไม้กระทุ้งกลองใหญ่ (เบส)"
     },
     "piano": {
      "name": "Piano",
      "cls": "ลิ่มนิ้ว",
      "detail": "ลิ่มนิ้ว",
      "tone": "เสียงเปียโน",
      "synth": "plucked",
      "review": true,
      "en": "Piano",
      "how": "กดคีย์ (ลิ่มนิ้ว) ด้วยนิ้วมือทั้งสองข้าง ค้อนภายในตีสาย"
     },
     "drum_set": {
      "name": "Drum Set",
      "cls": "กระทบ",
      "detail": "กระทบ",
      "tone": "เสียงกลองชุด",
      "synth": "struck_drum",
      "review": true,
      "en": "Drum set",
      "how": "ใช้ไม้ตีกลองชุดและฉาบ เท้าเหยียบกระเดื่องและไฮแฮต"
     },
     "upright_bass": {
      "name": "Double Bass",
      "cls": "สาย",
      "detail": "สาย",
      "tone": "เสียงเบสทุ้ม",
      "synth": "bowed",
      "review": true,
      "en": "Double bass",
      "how": "ยืนหรือนั่งเก้าอี้สูง ดีดสาย (หรือสีด้วยคันชัก)"
     },
     "e_guitar": {
      "name": "Electric Guitar",
      "cls": "สาย",
      "detail": "สาย",
      "tone": "เสียงกีตาร์ไฟฟ้า",
      "synth": "plucked",
      "review": true,
      "en": "Electric guitar",
      "how": "ดีดหรือรูดสายด้วยปิ๊กหรือนิ้ว กดสายตามเฟร็ต เสียงขยายผ่านแอมป์"
     },
     "bass_guitar": {
      "name": "Bass Guitar",
      "cls": "สาย",
      "detail": "สาย",
      "tone": "เสียงเบสไฟฟ้า",
      "synth": "plucked",
      "review": true,
      "en": "Bass guitar",
      "how": "ดีดสายด้วยนิ้วหรือปิ๊ก กดสายตามเฟร็ต เสียงขยายผ่านแอมป์"
     },
     "keyboard": {
      "name": "Keyboard",
      "cls": "ลิ่มนิ้ว",
      "detail": "ลิ่มนิ้ว",
      "tone": "เสียงคีย์บอร์ด",
      "synth": "plucked",
      "review": true,
      "en": "Keyboard",
      "how": "กดคีย์ (ลิ่มนิ้ว) ด้วยนิ้วมือ เสียงมาจากวงจรอิเล็กทรอนิกส์"
     },
     "vocal": {
      "name": "Vocal",
      "cls": "เสียงร้อง",
      "detail": "เสียงร้อง",
      "tone": "เสียงร้องนำ",
      "synth": "blown",
      "review": true,
      "en": "Vocal",
      "how": "ใช้เสียงร้อง (ไม่ใช่เครื่องดนตรี) ควบคุมลมหายใจและเสียง"
     }
    },
    "categories": {
     "thai": {
      "name": "วงดนตรีไทย",
      "ensembles": {
       "piphat_hard": {
        "name": "วงปี่พาทย์ไม้แข็งเครื่องคู่",
        "era": "กรุงรัตนโกสินทร์",
        "soundChar": "เสียงดังกังวาน แข็งแกร่ง เร้าใจ ใช้ไม้ตีหัวแข็ง",
        "occasion": "ใช้ในงานมงคล พิธีไหว้ครู โขน ละคร และการประโคม",
        "seating": [
         {
          "inst": "ranat_ek",
          "x": 50,
          "y": 35,
          "role": "เครื่องนำทำนอง (ผู้นำวง)",
          "tone": "เสียงแหลมสดใส คมชัด ดำเนินทำนองหลักและแปรทำนอง"
         },
         {
          "inst": "ranat_thum",
          "x": 25,
          "y": 35,
          "role": "เครื่องหยอกล้อขัดจังหวะ",
          "tone": "เสียงทุ้มนุ่ม ล้อเลียนขัดจังหวะทำนองหลัก"
         },
         {
          "inst": "khong_wong_yai",
          "x": 50,
          "y": 65,
          "role": "แม่บทแห่งทำนองหลัก (Root Melody)",
          "tone": "เสียงกังวานทุ้ม เป็นแก่นและโครงสร้างทำนองที่เครื่องอื่นต้องยึดถือ"
         },
         {
          "inst": "khong_wong_lek",
          "x": 75,
          "y": 35,
          "role": "เครื่องสอดแทรกทำนองสูง",
          "tone": "เสียงแหลมเล็ก ลวดลายพริ้วไหว สอดประสานเสียงสูง"
         },
         {
          "inst": "pi_nai",
          "x": 50,
          "y": 15,
          "role": "เครื่องเป่าดำเนินทำนองนำ",
          "tone": "เสียงแหลมโหยหวน มีพลัง ลมหายใจหมุนเวียน (ระบายลม)"
         },
         {
          "inst": "ching",
          "x": 80,
          "y": 65,
          "role": "ผู้นำและผู้กำกับจังหวะของวง",
          "tone": "เสียง ฉิ่ง (เปิด) และ ฉับ (ปิด) ควบคุมอัตราจังหวะ ช้า-ปานกลาง-เร็ว"
         },
         {
          "inst": "taphoon",
          "x": 20,
          "y": 65,
          "role": "เครื่องคุมหน้าทับจังหวะหลัก",
          "tone": "เสียงทุ้มกังวานและเสียงหนักแน่น เป็นครูใหญ่แห่งเครื่องจังหวะ"
         },
         {
          "inst": "klong_that",
          "x": 10,
          "y": 80,
          "role": "เครื่องส่งพลังและจังหวะหนัก",
          "tone": "เสียง ตูม (ตัวผู้) และ ต้อม (ตัวเมีย) ตีขานรับเพิ่มความฮึกเหิม"
         }
        ],
        "size": "เครื่องคู่",
        "wk5": "วก.5 คาบ 12: วงปี่พาทย์",
        "period": 12,
        "review": true,
        "image": {
         "file": "media/m1/p12/piphat_hard.jpg",
         "alt": "วงปี่พาทย์ไทย (กรุงเทพฯ)",
         "title": "(Piphat ensemble in Bangkok, Thailand) - DPLA - 8e8d06deb7efe72879836062e8e37c2c.jpg",
         "license": "CC BY 4.0",
         "author": "Sherwin John Carlquist",
         "page": "https://commons.wikimedia.org/wiki/File:%28Piphat_ensemble_in_Bangkok%2C_Thailand%29_-_DPLA_-_8e8d06deb7efe72879836062e8e37c2c.jpg",
         "source": "Wikimedia Commons",
         "period": 12
        }
       },
       "string_ensemble": {
        "name": "วงเครื่องสายผสมเครื่องคู่",
        "era": "สมัยอยุธยาตอนปลาย - รัตนโกสินทร์",
        "soundChar": "เสียงนุ่มนวล หวานซึ้ง ไพเราะ ไม่ดังกระโชกโฮกฮาก",
        "occasion": "บรรเลงในอาคาร งานเลี้ยงมงคล ขับกล่อม",
        "seating": [
         {
          "inst": "saw_duang",
          "x": 40,
          "y": 35,
          "role": "ผู้นำทำนองเสียงสูง",
          "tone": "เสียงแหลมหวาน คมชัด ดำเนินทำนองนำของเครื่องสาย"
         },
         {
          "inst": "saw_u",
          "x": 60,
          "y": 35,
          "role": "เครื่องทำนองเสียงทุ้มหวาน",
          "tone": "เสียงทุ้มลึก นุ่มนวล เคล้าคลอไปกับซอด้วง"
         },
         {
          "inst": "jakhe",
          "x": 30,
          "y": 55,
          "role": "เครื่องดีดโซโล่และดำเนินทำนองหลัก",
          "tone": "เสียงกังวานใส รัวนิ้วและสะบัดเสียงได้คล่องแคล่ว"
         },
         {
          "inst": "khlui_phiang_aw",
          "x": 70,
          "y": 55,
          "role": "เครื่องเป่าสอดแทรกนุ่มนวล",
          "tone": "เสียงโหยหวน นุ่มนวล สอดประสานคลอเคล้าเสียงร้อง"
         },
         {
          "inst": "ching",
          "x": 85,
          "y": 70,
          "role": "เครื่องกำกับจังหวะหน้าทับ",
          "tone": "คุมจังหวะเบา-ดัง พอเหมาะกับความนุ่มของเครื่องสาย"
         },
         {
          "inst": "thon_rammana",
          "x": 15,
          "y": 70,
          "role": "เครื่องคุมหน้าทับคู่",
          "tone": "โทนให้เสียงป้อง รำมะนาให้เสียงปิ๊ง สอดประสานเข้ากัน"
         }
        ],
        "size": "เครื่องคู่",
        "wk5": "วก.5 คาบ 12: วงเครื่องสาย",
        "period": 12,
        "review": true,
        "image": {
         "file": "media/m1/p12/string_ensemble.jpg",
         "alt": "ภาพถ่ายเก่า (พ.ศ. 2473/2474) วงดนตรีไทยที่เน้นเครื่องสาย: ซออู้ จะเข้ ขลุ่ย ซอด้วง ระนาดเอก ฆ้องวง ระนาดทุ้ม โทน รำมะนา ฉิ่ง",
         "title": "Khrueang Mahori Piphat (1930, p. 43).jpg",
         "license": "Public domain",
         "author": "ไม่ทราบผู้สร้าง (หนังสือ พ.ศ. 2473/2474)",
         "page": "https://commons.wikimedia.org/wiki/File:Khrueang_Mahori_Piphat_%281930%2C_p._43%29.jpg",
         "source": "Wikimedia Commons",
         "period": 12,
         "teacherNote": "ภาพถ่ายเก่าจากหนังสือ พ.ศ. 2473/2474 คำบรรยายบน Commons: วงดนตรีไทยที่ \"เน้นเครื่องสาย\" (ซออู้ จะเข้ ขลุ่ย ซอด้วง + ระนาดเอก ฆ้องวง ระนาดทุ้ม โทน รำมะนา ฉิ่ง) — ไม่ได้ระบุว่าเป็น \"เครื่องสายผสมเครื่องคู่\" โดยตรง ครูโปรดยืนยันว่าใช้ประกอบวงนี้ได้ หรือเตรียมภาพของโรงเรียนแทน (ภาพเดิมที่ผิดคือภาพแผ่นเครื่องสายแยกชิ้นถูกถอดออกแล้ว)"
        }
       },
       "mahori": {
        "name": "วงมโหรีเครื่องใหญ่",
        "era": "รัตนโกสินทร์ (รวมเครื่องดนตรีไทยครบทุกตระกูล)",
        "soundChar": "สมบูรณ์แบบที่สุด มีทั้ง ดีด-สี-ตี-เป่า บรรเลงร่วมกันอย่างกลมกลืน",
        "occasion": "งานพระราชพิธี งานเฉลิมฉลองชั้นสูง",
        "seating": [
         {
          "inst": "ranat_ek_mahori",
          "x": 50,
          "y": 25,
          "role": "เครื่องตีนำทำนอง",
          "tone": "เสียงหวานใส ไม่ดังเกินเครื่องสาย"
         },
         {
          "inst": "saw_sam_sai",
          "x": 50,
          "y": 50,
          "role": "ราชินีแห่งเครื่องสาย คลอเสียงร้อง",
          "tone": "เสียงหวานซึ้ง ละเมียดละไม เป็นประธานแห่งวงมโหรี"
         },
         {
          "inst": "saw_duang",
          "x": 35,
          "y": 40,
          "role": "เครื่องสีนำทำนองสูง",
          "tone": "เสียงแหลมพริ้วไหว"
         },
         {
          "inst": "saw_u",
          "x": 65,
          "y": 40,
          "role": "เครื่องสีทำนองทุ้ม",
          "tone": "เสียงทุ้มละมุน"
         },
         {
          "inst": "jakhe",
          "x": 20,
          "y": 55,
          "role": "เครื่องดีดพริ้วกังวาน",
          "tone": "รัวเก็บเสียงดังกังวาน"
         },
         {
          "inst": "khlui",
          "x": 80,
          "y": 55,
          "role": "เครื่องเป่ากลมกลืน",
          "tone": "โหยหวนเชื่อมเสียงร้อง"
         },
         {
          "inst": "khong_mahori",
          "x": 50,
          "y": 70,
          "role": "โครงสร้างทำนองหลัก",
          "tone": "ขนาดเล็กกว่าฆ้องวงไทยเดิม ให้เสียงหวาน"
         }
        ],
        "size": "เครื่องใหญ่",
        "wk5": "วก.5 คาบ 12: วงมโหรี",
        "period": 12,
        "review": true,
        "image": {
         "file": "media/m1/p12/mahori.jpg",
         "alt": "ภาพถ่ายเก่า (พ.ศ. 2473/2474) วงดนตรีไทยของสตรี 12 คน: จะเข้ ขลุ่ย ระนาดเอก ระนาดเอกทอง ฆ้องวงใหญ่/เล็ก ซอสามสาย ระนาดทุ้ม โทน รำมะนา ฉิ่ง",
         "title": "Khrueang Mahori Piphat (1930, p. 39).jpg",
         "license": "Public domain",
         "author": "ไม่ทราบผู้สร้าง (หนังสือ พ.ศ. 2473/2474)",
         "page": "https://commons.wikimedia.org/wiki/File:Khrueang_Mahori_Piphat_%281930%2C_p._39%29.jpg",
         "source": "Wikimedia Commons",
         "period": 12,
         "teacherNote": "ภาพถ่ายเก่าจากหนังสือ \"เครื่องมโหรีปี่พาทย์\" พ.ศ. 2473/2474 คำบรรยายบน Commons เรียกว่า \"วงดนตรีไทยขนาดใหญ่\" ที่มีทั้งเครื่องสาย (จะเข้ ซอสามสาย) ขลุ่ย ระนาด ฆ้องวง โทน รำมะนา ฉิ่ง — องค์ประกอบใกล้เคียงวงมโหรี แต่ Commons ไม่ได้เขียนคำว่า \"มโหรี\" ครูโปรดยืนยัน หรือเตรียมภาพของโรงเรียนแทน"
        }
       }
      }
     },
     "folk": {
      "name": "วงดนตรีพื้นบ้าน 4 ภาค",
      "ensembles": {
       "lanna_salor": {
        "name": "วงสะล้อซอซึง (อัตลักษณ์ล้านนา • พะเยา)",
        "era": "วัฒนธรรมดนตรีล้านนาภาคเหนือ",
        "soundChar": "นุ่มนวล อ่อนช้อย สอดคล้องกับธรรมชาติและวิถีชีวิตชาวล้านนา",
        "occasion": "งานบุญประเพณี ขันโตก ต้อนรับแขกบ้านแขกเมืองกว๊านพะเยา",
        "seating": [
         {
          "inst": "salor",
          "x": 35,
          "y": 35,
          "role": "เครื่องสีนำทำนองหลักล้านนา",
          "tone": "เสียงหวานโหยหวน ลากคันชักพริ้วไหว"
         },
         {
          "inst": "seung",
          "x": 65,
          "y": 35,
          "role": "เครื่องดีดคลอทำนองและคอร์ด",
          "tone": "เสียงดีดกังวาน นุ่มนวล เคาะจังหวะนิ้วเป็นเอกลักษณ์"
         },
         {
          "inst": "pi_jum",
          "x": 50,
          "y": 20,
          "role": "เครื่องเป่าบรรเลงคลอซอ",
          "tone": "เสียงโอดครวญ นุ่มนวล เข้ากับบทขับซอล้านนา"
         },
         {
          "inst": "klong_teungnong",
          "x": 50,
          "y": 65,
          "role": "เครื่องกำกับจังหวะพื้นบ้าน",
          "tone": "เสียงทุ้มแน่น คุมจังหวะช้าเนิบนาบสไตล์ล้านนา"
         }
        ],
        "region": "ภาคเหนือ (ล้านนา)",
        "wk5": "วก.5 คาบ 12: สะล้อซอซึงล้านนา",
        "period": 12,
        "review": true,
        "image": {
         "file": "media/m1/p12/lanna_salor.jpg",
         "alt": "ดนตรีพื้นบ้านลับแล (จ.อุตรดิตถ์): นักดนตรีเล่นเครื่องสี เครื่องดีด และขลุ่ย ณ พิพิธภัณฑ์ท้องถิ่นวัดคุ้งตะเภา",
         "title": "Traditional Laplae folk music 2.JPG",
         "license": "CC BY-SA 3.0",
         "author": "เทวประภาส มากคล้าย",
         "page": "https://commons.wikimedia.org/wiki/File:Traditional_Laplae_folk_music_2.JPG",
         "source": "Wikimedia Commons",
         "period": 12,
         "teacherNote": "Commons ระบุว่าเป็น \"ดนตรีพื้นบ้านลับแล จ.อุตรดิตถ์\" ไม่ได้ระบุว่าเป็นวงสะล้อ ซอ ซึง ของล้านนา/พะเยา ภาพนี้เป็นตัวอย่างวงดนตรีพื้นบ้านภาคเหนือเท่านั้น ครูโปรดยืนยัน หรือเตรียมภาพวงสะล้อซอซึงของโรงเรียน/พะเยาแทน"
        }
       },
       "ponglang": {
        "name": "วงโปงลาง (ภาคอีสาน)",
        "era": "วัฒนธรรมอีสาน ลุ่มแม่น้ำชีและโขง",
        "soundChar": "คึกคัก สนุกสนาน รวดเร็ว สะท้อนความร่าเริงของชาวอีสาน",
        "occasion": "งานบุญบั้งไฟ งานแห่ ฟ้อนรำฉลองเทศกาล",
        "seating": [
         {
          "inst": "ponglang_inst",
          "x": 40,
          "y": 30,
          "role": "เครื่องนำทำนองลายอีสาน",
          "tone": "เสียงคม แข็ง ใส แขวนเล่น 2 คน (คนตีทำนอง + คนตีลูกเสพ)"
         },
         {
          "inst": "phin",
          "x": 60,
          "y": 30,
          "role": "เครื่องดีดโซโล่สะบัดนิ้ว",
          "tone": "เสียงหวานใส รัวนิ้วเร็วเร้าใจ ลายเต้ย ลายภูไท"
         },
         {
          "inst": "khene",
          "x": 25,
          "y": 45,
          "role": "ราชาแห่งเครื่องเป่าอีสาน",
          "tone": "มีเสียงประสานคอร์ดในตัว พลังเสียงพริ้วต่อเนื่องไม่ขาดสาย"
         },
         {
          "inst": "wot",
          "x": 75,
          "y": 45,
          "role": "เครื่องเป่าไร้ลิ้นเสียงสูง",
          "tone": "เสียงหมุนเหวี่ยงสูง คล้ายเสียงนกบินร่อนบนท้องฟ้า"
         },
         {
          "inst": "hai_song",
          "x": 50,
          "y": 65,
          "role": "เครื่องประกอบลีลาและเบส",
          "tone": "ดึงสายยางปากไห ให้เสียงเบสทุ้มต่ำและท่าฟ้อนรำสวยงาม"
         }
        ],
        "region": "ภาคตะวันออกเฉียงเหนือ (อีสาน)",
        "wk5": "วก.5 คาบ 12: โปงลางอีสาน",
        "period": 12,
        "review": true,
        "image": {
         "file": "media/m1/p12/ponglang.jpg",
         "alt": "โปงลาง (ระนาดไม้แขวนของภาคอีสาน)",
         "title": "Pong lang (Thai xylophone).jpg",
         "license": "CC BY-SA 2.0",
         "author": "Ross Robinson",
         "page": "https://commons.wikimedia.org/wiki/File:Pong_lang_%28Thai_xylophone%29.jpg",
         "source": "Wikimedia Commons",
         "period": 12,
         "teacherNote": "ภาพนี้เป็นตัวโปงลาง (เครื่องดนตรี) ที่จัดแสดงในพิพิธภัณฑ์ ไม่ใช่ภาพทั้งวง — ถ้าครูมีภาพวงโปงลางจริงของโรงเรียน/ท้องถิ่น แนะนำให้ใช้แทน"
        }
       },
       "klong_yao": {
        "name": "วงกลองยาว (ภาคกลาง)",
        "region": "ภาคกลาง",
        "wk5": "วก.5 คาบ 12: กลองยาวภาคกลาง",
        "period": 12,
        "era": "ภาคกลาง (รายละเอียดรอครูตรวจ)",
        "soundChar": "จังหวะคึกคัก สนุกสนาน (รอครูตรวจ)",
        "occasion": "งานแห่ งานรื่นเริง (รอครูตรวจ)",
        "seating": [
         {
          "inst": "klong_yao",
          "x": 50,
          "y": 30,
          "role": "เครื่องให้จังหวะหลัก",
          "tone": null
         },
         {
          "inst": "ching_folk",
          "x": 25,
          "y": 50,
          "role": "กำกับจังหวะ",
          "tone": null
         },
         {
          "inst": "chap",
          "x": 75,
          "y": 50,
          "role": "เน้นจังหวะ",
          "tone": null
         },
         {
          "inst": "krap",
          "x": 35,
          "y": 70,
          "role": "ให้จังหวะประกอบ",
          "tone": null
         },
         {
          "inst": "mhong",
          "x": 65,
          "y": 70,
          "role": "กำกับจังหวะเสียงทุ้ม",
          "tone": null
         }
        ],
        "review": true,
        "image": {
         "file": "media/m1/p12/klong_yao.jpg",
         "alt": "ขบวนกลองยาว",
         "title": "Klong Yao Parade 2.jpg",
         "license": "CC BY-SA 4.0",
         "author": "B20180",
         "page": "https://commons.wikimedia.org/wiki/File:Klong_Yao_Parade_2.jpg",
         "source": "Wikimedia Commons",
         "period": 12
        }
       },
       "rongngeng": {
        "name": "วงรองเง็ง (ภาคใต้)",
        "region": "ภาคใต้",
        "wk5": "วก.5 คาบ 12: รองเง็งภาคใต้",
        "period": 12,
        "era": "ภาคใต้ (รายละเอียดรอครูตรวจ)",
        "soundChar": "จังหวะสนุก ท่วงทำนองหวาน (รอครูตรวจ)",
        "occasion": "งานรื่นเริงและการแสดงของภาคใต้ (รอครูตรวจ)",
        "seating": [
         {
          "inst": "violin_rong",
          "x": 50,
          "y": 30,
          "role": "นำทำนอง",
          "tone": null
         },
         {
          "inst": "ramana_s",
          "x": 30,
          "y": 60,
          "role": "ให้จังหวะ",
          "tone": null
         },
         {
          "inst": "khong_s",
          "x": 70,
          "y": 60,
          "role": "กำกับจังหวะ",
          "tone": null
         }
        ],
        "note": "เครื่องดนตรีของแต่ละคณะอาจแตกต่างกัน ครูโปรดตรวจและเพิ่มเติมให้ตรงกับที่สอนในชั้นเรียน",
        "review": true,
        "imageTeacherNote": "ครูเตรียมภาพ: ยังไม่มีภาพถ่ายวงรองเง็ง (ภาคใต้) ที่ตรวจสิทธิ์และตรวจเนื้อหาแล้ว — Wikimedia Commons ไม่พบภาพรองเง็งของไทย (ภาพ \"ronggeng\" ที่พบเป็นของอินโดนีเซีย ซึ่งเป็นคนละประเพณี จึงไม่นำมาใช้) นักเรียนจึงไม่เห็นกรอบภาพของวงนี้ ถ้าครูมีภาพของโรงเรียน/ท้องถิ่น ให้ส่งไฟล์ แล้วจะใส่พร้อมเครดิต"
       }
      }
     },
     "western": {
      "name": "วงดนตรีสากล",
      "ensembles": {
       "orchestra": {
        "name": "Symphony Orchestra (วงดุริยางค์ซิมโฟนี)",
        "era": "ยุคคลาสสิก - ปัจจุบัน",
        "soundChar": "ยิ่งใหญ่ อลังการ มีมิติความดัง-เบา (Dynamics) กว้างที่สุดในโลกดนตรี",
        "occasion": "คอนเสิร์ตฮอลล์ เพลงคลาสสิก บัลเลต์ ประกอบภาพยนตร์ระดับโลก",
        "seating": [
         {
          "inst": "first_violin",
          "x": 25,
          "y": 55,
          "role": "ผู้นำกลุ่มเครื่องสายและทำนองหลัก",
          "tone": "เสียงสูงสดใส พริ้วไหว กังวาน"
         },
         {
          "inst": "second_violin",
          "x": 32,
          "y": 65,
          "role": "แนวประสานเสียงสูง",
          "tone": "สอดประสานกับ Violin 1"
         },
         {
          "inst": "viola",
          "x": 68,
          "y": 65,
          "role": "แนวเสียงกลาง (Tenor/Alto)",
          "tone": "เสียงอุ่น หนา นุ่ม เป็นสะพานเชื่อมเสียงสูงกับต่ำ"
         },
         {
          "inst": "cello",
          "x": 75,
          "y": 55,
          "role": "แนวเบสและทำนองหวานทุ้ม",
          "tone": "เสียงทุ้มลึก มีพลัง สื่ออารมณ์ซาบซึ้ง"
         },
         {
          "inst": "double_bass",
          "x": 88,
          "y": 50,
          "role": "รากฐานเสียงต่ำสุดของวง (Sub-Bass)",
          "tone": "เสียงทุ้มต่ำ หนักแน่น ยึดโครงสร้างฮาร์โมนี"
         },
         {
          "inst": "woodwinds",
          "x": 50,
          "y": 45,
          "role": "สีสันทำนองเดี่ยวและลมหายใจ",
          "tone": "เสียงนุ่มนวล มีเอกลักษณ์เฉพาะตัวสูง"
         },
         {
          "inst": "brass",
          "x": 50,
          "y": 30,
          "role": "ความยิ่งใหญ่ พลังอำนาจ เสียงสะท้อน",
          "tone": "เสียงดังก้องกังวาน สง่างาม"
         },
         {
          "inst": "timpani",
          "x": 30,
          "y": 20,
          "role": "จังหวะเน้นย้ำและพายุแห่งเสียง",
          "tone": "เสียงทุ้มกึกก้อง กำหนดจุดไคลแมกซ์ของบทเพลง"
         },
         {
          "inst": "conductor",
          "x": 50,
          "y": 80,
          "role": "ผู้อำนวยเพลง คุมจังหวะและบาลานซ์เสียง",
          "tone": "ใช้ไม้บาตองสื่อสารอารมณ์และคิวการเข้าเล่น"
         }
        ],
        "wk5": "วก.5 คาบ 14: วงดุริยางค์ซิมโฟนี",
        "period": 14,
        "review": true,
        "image": {
         "file": "media/m1/p14/orchestra.jpg",
         "alt": "วงออร์เคสตรากับคณะขับร้องประสานเสียง (Bothell, สหรัฐฯ)",
         "title": "BothellsOrchestraPerformingMessiah.JPG",
         "license": "CC BY-SA 3.0",
         "author": "Peterbacon",
         "page": "https://commons.wikimedia.org/wiki/File:BothellsOrchestraPerformingMessiah.JPG",
         "source": "Wikimedia Commons",
         "period": 14
        }
       },
       "concert_band": {
        "name": "Concert Band / Marching Band (วงโยธวาทิต)",
        "era": "(รอครูตรวจ)",
        "soundChar": "เสียงลมไม้และทองเหลืองกังวาน (รอครูตรวจ)",
        "occasion": "งานพิธี ขบวนแห่ ขับเคลื่อนด้วยจังหวะ (รอครูตรวจ)",
        "wk5": "วก.5 คาบ 14: คอนเสิร์ตแบนด์/โยธวาทิต",
        "period": 14,
        "seating": [
         {
          "inst": "flute_cl",
          "x": 30,
          "y": 30,
          "role": "ทำนองเสียงสูง",
          "tone": null
         },
         {
          "inst": "sax",
          "x": 70,
          "y": 30,
          "role": "ทำนองและประสาน",
          "tone": null
         },
         {
          "inst": "trumpet",
          "x": 35,
          "y": 55,
          "role": "ทำนองทองเหลือง",
          "tone": null
         },
         {
          "inst": "trombone",
          "x": 65,
          "y": 55,
          "role": "ประสานเสียงกลาง",
          "tone": null
         },
         {
          "inst": "tuba_euph",
          "x": 50,
          "y": 70,
          "role": "เบส",
          "tone": null
         },
         {
          "inst": "snare_bass",
          "x": 50,
          "y": 20,
          "role": "จังหวะ",
          "tone": null
         }
        ],
        "review": true,
        "image": {
         "file": "media/m1/p14/concert_band.jpg",
         "alt": "วงเครื่องเป่า (Concert band)",
         "title": "Bjergsted blåseensemble.jpg",
         "license": "CC BY-SA 4.0",
         "author": "Rafaele",
         "page": "https://commons.wikimedia.org/wiki/File:Bjergsted_bl%C3%A5seensemble.jpg",
         "source": "Wikimedia Commons",
         "period": 14
        }
       },
       "string_quartet": {
        "name": "Chamber Music — String Quartet (วงสตริงควอร์เท็ต)",
        "era": "ยุคคลาสสิก (Haydn, Mozart, Beethoven)",
        "soundChar": "ประณีต ลึกซึ้ง บทสนทนาระหว่างเครื่องสาย 4 ชิ้นอย่างลงตัว",
        "occasion": "Chamber Music ในห้องฟังขนาดเล็ก งานพิธีอบอุ่น",
        "seating": [
         {
          "inst": "sq_v1",
          "x": 30,
          "y": 40,
          "role": "ผู้นำบทสนทนาและทำนองหลัก",
          "tone": "เสียงสูงสดใส ชวนคุย"
         },
         {
          "inst": "sq_v2",
          "x": 40,
          "y": 65,
          "role": "ผู้รับคำและสอดประสาน",
          "tone": "ช่วยเติมเต็มฮาร์โมนี"
         },
         {
          "inst": "sq_va",
          "x": 60,
          "y": 65,
          "role": "ผู้ให้ความอบอุ่นช่วงกลาง",
          "tone": "เสียงทุ้มกลางลึกซึ้ง"
         },
         {
          "inst": "sq_vc",
          "x": 70,
          "y": 40,
          "role": "ฐานรากเสียงทุ้มต่ำ",
          "tone": "เสียงเบสทุ้มกังวานรองรับทุกคน"
         }
        ],
        "wk5": "วก.5 คาบ 14: แชมเบอร์มิวสิก (ตัวอย่าง: String Quartet)",
        "period": 14,
        "review": true,
        "image": {
         "file": "media/m1/p14/string_quartet.jpg",
         "alt": "นักดนตรีเครื่องสายตะวันตกสามคน (ไวโอลิน 2 เชลโล 1) ในวง North Sea String Quartet แสดงริมถนนที่เทศกาล Rudolstadt (ภาพเห็น 3 ใน 4 คน)",
         "title": "North Sea String Quartet 01.jpg",
         "license": "CC BY-SA 4.0",
         "author": "Schorle",
         "page": "https://commons.wikimedia.org/wiki/File:North_Sea_String_Quartet_01.jpg",
         "source": "Wikimedia Commons",
         "period": 14,
         "teacherNote": "ภาพเห็นนักดนตรี 3 คน (ไวโอลิน 2 เชลโล 1) ไม่เห็นวิโอลา และมีป้ายเตือนสิทธิ์บุคคลของ Commons (เห็นใบหน้าบุคคลจริง) — ครูโปรดพิจารณาว่าเหมาะกับห้องเรียนหรือไม่ หรือเปลี่ยนเป็นภาพอื่น"
        }
       },
       "jazz_band": {
        "name": "Jazz / Big Band (วงแจ๊ส)",
        "era": "(รอครูตรวจ)",
        "soundChar": "จังหวะสวิง ด้นสด (รอครูตรวจ)",
        "occasion": "คอนเสิร์ตแจ๊ส ไนต์คลับ (รอครูตรวจ)",
        "wk5": "วก.5 คาบ 14: แจ๊ส/บิ๊กแบนด์",
        "period": 14,
        "seating": [
         {
          "inst": "sax",
          "x": 25,
          "y": 35,
          "role": "กลุ่มแซกโซโฟน",
          "tone": null
         },
         {
          "inst": "trumpet",
          "x": 50,
          "y": 25,
          "role": "กลุ่มทรัมเป็ต",
          "tone": null
         },
         {
          "inst": "trombone",
          "x": 75,
          "y": 35,
          "role": "กลุ่มทรอมโบน",
          "tone": null
         },
         {
          "inst": "piano",
          "x": 25,
          "y": 65,
          "role": "ประสานคอร์ด",
          "tone": null
         },
         {
          "inst": "upright_bass",
          "x": 50,
          "y": 70,
          "role": "เบส",
          "tone": null
         },
         {
          "inst": "drum_set",
          "x": 75,
          "y": 65,
          "role": "จังหวะ",
          "tone": null
         }
        ],
        "review": true,
        "image": {
         "file": "media/m1/p14/jazz_band.jpg",
         "alt": "วงแจ๊สบิ๊กแบนด์",
         "title": "P. Mauriat Jazz Band Summer Live 20190713a.jpg",
         "license": "CC0",
         "author": "玄史生 (Xuanshisheng)",
         "page": "https://commons.wikimedia.org/wiki/File:P._Mauriat_Jazz_Band_Summer_Live_20190713a.jpg",
         "source": "Wikimedia Commons",
         "period": 14
        }
       },
       "pop_rock": {
        "name": "Pop-Rock Band (วงสตริงคอมโบ/ป็อป-ร็อก)",
        "era": "(รอครูตรวจ)",
        "soundChar": "เสียงไฟฟ้า จังหวะหนักแน่น (รอครูตรวจ)",
        "occasion": "คอนเสิร์ต เพลงสมัยนิยม (รอครูตรวจ)",
        "wk5": "วก.5 คาบ 14: สตริงคอมโบ/ป็อป-ร็อกแบนด์",
        "period": 14,
        "seating": [
         {
          "inst": "vocal",
          "x": 50,
          "y": 25,
          "role": "ร้องนำ",
          "tone": null
         },
         {
          "inst": "e_guitar",
          "x": 25,
          "y": 45,
          "role": "ทำนอง/คอร์ด",
          "tone": null
         },
         {
          "inst": "keyboard",
          "x": 75,
          "y": 45,
          "role": "คอร์ด/ทำนอง",
          "tone": null
         },
         {
          "inst": "bass_guitar",
          "x": 30,
          "y": 70,
          "role": "เบส",
          "tone": null
         },
         {
          "inst": "drum_set",
          "x": 70,
          "y": 70,
          "role": "จังหวะ",
          "tone": null
         }
        ],
        "review": true,
        "image": {
         "file": "media/m1/p14/pop_rock.jpg",
         "alt": "วงป็อป-ร็อก (วงร็อกบนเวทีเทศกาล)",
         "title": "The Norwegian rock band TNT at Sweden Rock Festival 2023.jpg",
         "license": "CC BY-SA 4.0",
         "author": "Aphasia83",
         "page": "https://commons.wikimedia.org/wiki/File:The_Norwegian_rock_band_TNT_at_Sweden_Rock_Festival_2023.jpg",
         "source": "Wikimedia Commons",
         "period": 14
        }
       }
      }
     }
    },
    "listening": {
     "period": 16,
     "wk5": "วก.5 คาบ 16 (ม.1): เปรียบเทียบเสียงต่างวัฒนธรรม อารมณ์ ความเร็ว (Tempo) ความดัง-เบา (Dynamics) และ Feldman 4 ขั้นตอน",
     "note": "กิจกรรมสำรองในแอปเมื่อครูยังไม่มีไฟล์เสียงจริงของคาบ 16 — ใช้เสียงจำลองจาก Web Audio ไม่ใช่เสียงเครื่องดนตรีจริง; ไม่นับคะแนนเก็บ (ครูให้คะแนนเอง)",
     "tempos": [
      {
       "id": "slow",
       "label": "ช้า",
       "bpm": 60
      },
      {
       "id": "moderate",
       "label": "ปานกลาง",
       "bpm": 96
      },
      {
       "id": "fast",
       "label": "เร็ว",
       "bpm": 144
      }
     ],
     "dynamics": [
      {
       "id": "soft",
       "label": "เบา (p)",
       "gain": 0.25
      },
      {
       "id": "medium",
       "label": "ปานกลาง (mf)",
       "gain": 0.6
      },
      {
       "id": "loud",
       "label": "ดัง (f)",
       "gain": 1
      }
     ],
     "moods": [
      "สงบ",
      "สนุกสนาน",
      "สง่างาม",
      "ตื่นเต้น",
      "เศร้า/ครุ่นคิด"
     ],
     "pattern": [
      1,
      1.125,
      1.25,
      1.125,
      1,
      1.25,
      1.125,
      1
     ],
     "feldman": [
      {
       "key": "description",
       "label": "1) Description",
       "hint": "ได้ยินอะไร",
       "prompt": "เล่าสิ่งที่ได้ยินในเสียง A และ B ตามจริง (ยังไม่ตัดสินว่าชอบหรือไม่)"
      },
      {
       "key": "analysis",
       "label": "2) Analysis",
       "hint": "วิเคราะห์องค์ประกอบดนตรี",
       "prompt": "เปรียบเทียบสีสันเสียง ความเร็ว และความดัง-เบา ของ A กับ B"
      },
      {
       "key": "interpretation",
       "label": "3) Interpretation",
       "hint": "ตีความอารมณ์/ความหมาย",
       "prompt": "เสียงนี้ให้อารมณ์หรือความหมายอะไร เพราะอะไร"
      },
      {
       "key": "judgement",
       "label": "4) Judgement",
       "hint": "ประเมินคุณค่าเชิงสุนทรียะ",
       "prompt": "ให้เหตุผลที่เป็นกลาง ไม่ใช้เพียง \"ชอบ/ไม่ชอบ\" และเคารพความหลากหลายของดนตรีแต่ละวัฒนธรรม"
      }
     ],
     "review": true
    },
    "howBySynth": {
     "struck": "ใช้ไม้หรือมือตีให้เกิดเสียง",
     "struck_drum": "ใช้มือหรือไม้ตีที่หน้ากลอง",
     "bell": "ตีหรือกระทบให้เกิดเสียง",
     "blown": "เป่าลมให้เกิดเสียง",
     "bowed": "ใช้คันชักสีสาย",
     "plucked": "ดีดสายให้เกิดเสียง",
     "brass": "เป่าลมให้ริมฝีปากสั่นในเมาท์พีซ",
     "generic": "ดูรายละเอียดในแหล่งเรียนรู้ที่ครูกำหนด"
    }
   };
  root.ENSEMBLE_DATA = ENSEMBLE_DATA;
  if (typeof module !== 'undefined' && module.exports) module.exports = ENSEMBLE_DATA;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

// ==========================================================================
// Interactive Ensemble Explorer (ห้องสำรวจวงดนตรีไทย สากล และพื้นบ้านเสมือนจริง)
// สื่อการจัดการเรียนรู้เชิงรุก (Active Learning Media) • สาระการเรียนรู้ศิลปะ (ดนตรี)
// โรงเรียนพะเยาพิทยาคม • รองรับตัวชี้วัด ศ 2.1 ม.1/4, ม.2/1
// 100% Dynamic - Zero Hardcoding
// ==========================================================================

const EnsembleExplorer = {
  activeCategory: 'thai', // 'thai' | 'folk' | 'western'
  activeEnsembleKey: 'piphat_hard',
  selectedInstrument: null,

  // ฐานข้อมูลโครงสร้างวงดนตรี ผังที่นั่ง และบทบาทหน้าที่
  data: {
    thai: {
      categoryName: 'วงดนตรีไทย',
      ensembles: {
        piphat_hard: {
          name: 'วงปี่พาทย์ไม้แข็งเครื่องคู่',
          era: 'กรุงรัตนโกสินทร์',
          soundChar: 'เสียงดังกังวาน แข็งแกร่ง เร้าใจ ใช้ไม้ตีหัวแข็ง',
          occasion: 'ใช้ในงานมงคล พิธีไหว้ครู โขน ละคร และการประโคม',
          seating: [
            { id: 'ranat_ek', name: 'ระนาดเอก', role: 'เครื่องนำทำนอง (ผู้นำวง)', family: 'เครื่องตี', tone: 'เสียงแหลมสดใส คมชัด ดำเนินทำนองหลักและแปรทำนอง', x: 50, y: 35 },
            { id: 'ranat_thum', name: 'ระนาดทุ้ม', role: 'เครื่องหยอกล้อขัดจังหวะ', family: 'เครื่องตี', tone: 'เสียงทุ้มนุ่ม ล้อเลียนขัดจังหวะทำนองหลัก', x: 25, y: 35 },
            { id: 'khong_wong_yai', name: 'ฆ้องวงใหญ่', role: 'แม่บทแห่งทำนองหลัก (Root Melody)', family: 'เครื่องตี', tone: 'เสียงกังวานทุ้ม เป็นแก่นและโครงสร้างทำนองที่เครื่องอื่นต้องยึดถือ', x: 50, y: 65 },
            { id: 'khong_wong_lek', name: 'ฆ้องวงเล็ก', role: 'เครื่องสอดแทรกทำนองสูง', family: 'เครื่องตี', tone: 'เสียงแหลมเล็ก ลวดลายพริ้วไหว สอดประสานเสียงสูง', x: 75, y: 35 },
            { id: 'pi_nai', name: 'ปี่ใน', role: 'เครื่องเป่าดำเนินทำนองนำ', family: 'เครื่องเป่า', tone: 'เสียงแหลมโหยหวน มีพลัง ลมหายใจหมุนเวียน (ระบายลม)', x: 50, y: 15 },
            { id: 'ching', name: 'ฉิ่ง', role: 'ผู้นำและผู้กำกับจังหวะของวง', family: 'เครื่องประกอบจังหวะ', tone: 'เสียง ฉิ่ง (เปิด) และ ฉับ (ปิด) ควบคุมอัตราจังหวะ ช้า-ปานกลาง-เร็ว', x: 80, y: 65 },
            { id: 'taphoon', name: 'ตะโพนไทย', role: 'เครื่องคุมหน้าทับจังหวะหลัก', family: 'เครื่องหนัง', tone: 'เสียงทุ้มกังวานและเสียงหนักแน่น เป็นครูใหญ่แห่งเครื่องจังหวะ', x: 20, y: 65 },
            { id: 'klong_that', name: 'กลองทัด (คู่)', role: 'เครื่องส่งพลังและจังหวะหนัก', family: 'เครื่องหนัง', tone: 'เสียง ตูม (ตัวผู้) และ ต้อม (ตัวเมีย) ตีขานรับเพิ่มความฮึกเหิม', x: 10, y: 80 }
          ]
        },
        string_ensemble: {
          name: 'วงเครื่องสายผสมเครื่องคู่',
          era: 'สมัยอยุธยาตอนปลาย - รัตนโกสินทร์',
          soundChar: 'เสียงนุ่มนวล หวานซึ้ง ไพเราะ ไม่ดังกระโชกโฮกฮาก',
          occasion: 'บรรเลงในอาคาร งานเลี้ยงมงคล ขับกล่อม',
          seating: [
            { id: 'saw_duang', name: 'ซอด้วง', role: 'ผู้นำทำนองเสียงสูง', family: 'เครื่องสี', tone: 'เสียงแหลมหวาน คมชัด ดำเนินทำนองนำของเครื่องสาย', x: 40, y: 35 },
            { id: 'saw_u', name: 'ซออู้', role: 'เครื่องทำนองเสียงทุ้มหวาน', family: 'เครื่องสี', tone: 'เสียงทุ้มลึก นุ่มนวล เคล้าคลอไปกับซอด้วง', x: 60, y: 35 },
            { id: 'jakhe', name: 'จะเข้', role: 'เครื่องดีดโซโล่และดำเนินทำนองหลัก', family: 'เครื่องดีด', tone: 'เสียงกังวานใส รัวนิ้วและสะบัดเสียงได้คล่องแคล่ว', x: 30, y: 55 },
            { id: 'khlui_phiang_aw', name: 'ขลุ่ยเพียงออ', role: 'เครื่องเป่าสอดแทรกนุ่มนวล', family: 'เครื่องเป่า', tone: 'เสียงโหยหวน นุ่มนวล สอดประสานคลอเคล้าเสียงร้อง', x: 70, y: 55 },
            { id: 'ching', name: 'ฉิ่ง', role: 'เครื่องกำกับจังหวะหน้าทับ', family: 'เครื่องกำกับจังหวะ', tone: 'คุมจังหวะเบา-ดัง พอเหมาะกับความนุ่มของเครื่องสาย', x: 85, y: 70 },
            { id: 'thon_rammana', name: 'โทน-รำมะนา', role: 'เครื่องคุมหน้าทับคู่', family: 'เครื่องหนัง', tone: 'โทนให้เสียงป้อง รำมะนาให้เสียงปิ๊ง สอดประสานเข้ากัน', x: 15, y: 70 }
          ]
        },
        mahori: {
          name: 'วงมโหรีเครื่องใหญ่',
          era: 'รัตนโกสินทร์ (รวมเครื่องดนตรีไทยครบทุกตระกูล)',
          soundChar: 'สมบูรณ์แบบที่สุด มีทั้ง ดีด-สี-ตี-เป่า บรรเลงร่วมกันอย่างกลมกลืน',
          occasion: 'งานพระราชพิธี งานเฉลิมฉลองชั้นสูง',
          seating: [
            { id: 'ranat_ek_mahori', name: 'ระนาดเอกมโหรี (ย่อส่วน)', role: 'เครื่องตีนำทำนอง', family: 'เครื่องตี', tone: 'เสียงหวานใส ไม่ดังเกินเครื่องสาย', x: 50, y: 25 },
            { id: 'saw_sam_sai', name: 'ซอสามสาย', role: 'ราชินีแห่งเครื่องสาย คลอเสียงร้อง', family: 'เครื่องสี', tone: 'เสียงหวานซึ้ง ละเมียดละไม เป็นประธานแห่งวงมโหรี', x: 50, y: 50 },
            { id: 'saw_duang', name: 'ซอด้วง', role: 'เครื่องสีนำทำนองสูง', family: 'เครื่องสี', tone: 'เสียงแหลมพริ้วไหว', x: 35, y: 40 },
            { id: 'saw_u', name: 'ซออู้', role: 'เครื่องสีทำนองทุ้ม', family: 'เครื่องสี', tone: 'เสียงทุ้มละมุน', x: 65, y: 40 },
            { id: 'jakhe', name: 'จะเข้', role: 'เครื่องดีดพริ้วกังวาน', family: 'เครื่องดีด', tone: 'รัวเก็บเสียงดังกังวาน', x: 20, y: 55 },
            { id: 'khlui', name: 'ขลุ่ยเพียงออ/หลิบ', role: 'เครื่องเป่ากลมกลืน', family: 'เครื่องเป่า', tone: 'โหยหวนเชื่อมเสียงร้อง', x: 80, y: 55 },
            { id: 'khong_mahori', name: 'ฆ้องวงมโหรี', role: 'โครงสร้างทำนองหลัก', family: 'เครื่องตี', tone: 'ขนาดเล็กกว่าฆ้องวงไทยเดิม ให้เสียงหวาน', x: 50, y: 70 }
          ]
        }
      }
    },
    folk: {
      categoryName: 'วงดนตรีพื้นบ้าน 4 ภาค',
      ensembles: {
        lanna_salor: {
          name: 'วงสะล้อซอซึง (อัตลักษณ์ล้านนา • พะเยา)',
          era: 'วัฒนธรรมดนตรีล้านนาภาคเหนือ',
          soundChar: 'นุ่มนวล อ่อนช้อย สอดคล้องกับธรรมชาติและวิถีชีวิตชาวล้านนา',
          occasion: 'งานบุญประเพณี ขันโตก ต้อนรับแขกบ้านแขกเมืองกว๊านพะเยา',
          seating: [
            { id: 'salor', name: 'สะล้อ (เล็ก/ใหญ่)', role: 'เครื่องสีนำทำนองหลักล้านนา', family: 'เครื่องสีพื้นบ้าน', tone: 'เสียงหวานโหยหวน ลากคันชักพริ้วไหว', x: 35, y: 35 },
            { id: 'seung', name: 'ซึง (กลาง/หลวง)', role: 'เครื่องดีดคลอทำนองและคอร์ด', family: 'เครื่องดีดพื้นบ้าน', tone: 'เสียงดีดกังวาน นุ่มนวล เคาะจังหวะนิ้วเป็นเอกลักษณ์', x: 65, y: 35 },
            { id: 'pi_jum', name: 'ปี่จุม (ปี่ก้อย/แม่)', role: 'เครื่องเป่าบรรเลงคลอซอ', family: 'เครื่องเป่าลิ้นเดี่ยว', tone: 'เสียงโอดครวญ นุ่มนวล เข้ากับบทขับซอล้านนา', x: 50, y: 20 },
            { id: 'klong_teungnong', name: 'กลองเต่งถิ้ง', role: 'เครื่องกำกับจังหวะพื้นบ้าน', family: 'เครื่องหนัง', tone: 'เสียงทุ้มแน่น คุมจังหวะช้าเนิบนาบสไตล์ล้านนา', x: 50, y: 65 }
          ]
        },
        ponglang: {
          name: 'วงโปงลาง (ภาคอีสาน)',
          era: 'วัฒนธรรมอีสาน ลุ่มแม่น้ำชีและโขง',
          soundChar: 'คึกคัก สนุกสนาน รวดเร็ว สะท้อนความร่าเริงของชาวอีสาน',
          occasion: 'งานบุญบั้งไฟ งานแห่ ฟ้อนรำฉลองเทศกาล',
          seating: [
            { id: 'ponglang_inst', name: 'โปงลาง', role: 'เครื่องนำทำนองลายอีสาน', family: 'เครื่องตีไม้', tone: 'เสียงคม แข็ง ใส แขวนเล่น 2 คน (คนตีทำนอง + คนตีลูกเสพ)', x: 40, y: 30 },
            { id: 'phin', name: 'พิณอีสาน (2-3 สาย)', role: 'เครื่องดีดโซโล่สะบัดนิ้ว', family: 'เครื่องดีด', tone: 'เสียงหวานใส รัวนิ้วเร็วเร้าใจ ลายเต้ย ลายภูไท', x: 60, y: 30 },
            { id: 'khene', name: 'แคน', role: 'ราชาแห่งเครื่องเป่าอีสาน', family: 'เครื่องเป่าลิ้นโลหะ', tone: 'มีเสียงประสานคอร์ดในตัว พลังเสียงพริ้วต่อเนื่องไม่ขาดสาย', x: 25, y: 45 },
            { id: 'wot', name: 'โหวด', role: 'เครื่องเป่าไร้ลิ้นเสียงสูง', family: 'เครื่องเป่า', tone: 'เสียงหมุนเหวี่ยงสูง คล้ายเสียงนกบินร่อนบนท้องฟ้า', x: 75, y: 45 },
            { id: 'hai_song', name: 'ไหซอง', role: 'เครื่องประกอบลีลาและเบส', family: 'เครื่องดีดสายยาง', tone: 'ดึงสายยางปากไห ให้เสียงเบสทุ้มต่ำและท่าฟ้อนรำสวยงาม', x: 50, y: 65 }
          ]
        }
      }
    },
    western: {
      categoryName: 'วงดนตรีสากล',
      ensembles: {
        orchestra: {
          name: 'Symphony Orchestra (วงดุริยางค์ซิมโฟนี)',
          era: 'ยุคคลาสสิก - ปัจจุบัน',
          soundChar: 'ยิ่งใหญ่ อลังการ มีมิติความดัง-เบา (Dynamics) กว้างที่สุดในโลกดนตรี',
          occasion: 'คอนเสิร์ตฮอลล์ เพลงคลาสสิก บัลเลต์ ประกอบภาพยนตร์ระดับโลก',
          seating: [
            { id: 'first_violin', name: 'Violin 1 (Concertmaster)', role: 'ผู้นำกลุ่มเครื่องสายและทำนองหลัก', family: 'Strings (เครื่องสาย)', tone: 'เสียงสูงสดใส พริ้วไหว กังวาน', x: 25, y: 55 },
            { id: 'second_violin', name: 'Violin 2', role: 'แนวประสานเสียงสูง', family: 'Strings', tone: 'สอดประสานกับ Violin 1', x: 32, y: 65 },
            { id: 'viola', name: 'Viola', role: 'แนวเสียงกลาง (Tenor/Alto)', family: 'Strings', tone: 'เสียงอุ่น หนา นุ่ม เป็นสะพานเชื่อมเสียงสูงกับต่ำ', x: 68, y: 65 },
            { id: 'cello', name: 'Cello', role: 'แนวเบสและทำนองหวานทุ้ม', family: 'Strings', tone: 'เสียงทุ้มลึก มีพลัง สื่ออารมณ์ซาบซึ้ง', x: 75, y: 55 },
            { id: 'double_bass', name: 'Double Bass', role: 'รากฐานเสียงต่ำสุดของวง (Sub-Bass)', family: 'Strings', tone: 'เสียงทุ้มต่ำ หนักแน่น ยึดโครงสร้างฮาร์โมนี', x: 88, y: 50 },
            { id: 'woodwinds', name: 'Woodwinds (Flute/Oboe/Clarinet/Bassoon)', role: 'สีสันทำนองเดี่ยวและลมหายใจ', family: 'Woodwinds (เครื่องลมไม้)', tone: 'เสียงนุ่มนวล มีเอกลักษณ์เฉพาะตัวสูง', x: 50, y: 45 },
            { id: 'brass', name: 'Brass (Horn/Trumpet/Trombone/Tuba)', role: 'ความยิ่งใหญ่ พลังอำนาจ เสียงสะท้อน', family: 'Brass (เครื่องลมทองเหลือง)', tone: 'เสียงดังก้องกังวาน สง่างาม', x: 50, y: 30 },
            { id: 'timpani', name: 'Timpani & Percussion', role: 'จังหวะเน้นย้ำและพายุแห่งเสียง', family: 'Percussion (เครื่องกระทบ)', tone: 'เสียงทุ้มกึกก้อง กำหนดจุดไคลแมกซ์ของบทเพลง', x: 30, y: 20 },
            { id: 'conductor', name: 'Conductor (วาทยกร)', role: 'ผู้อำนวยเพลง คุมจังหวะและบาลานซ์เสียง', family: 'Leadership', tone: 'ใช้ไม้บาตองสื่อสารอารมณ์และคิวการเข้าเล่น', x: 50, y: 80 }
          ]
        },
        string_quartet: {
          name: 'String Quartet (วงสตริงควอร์เท็ต)',
          era: 'ยุคคลาสสิก (Haydn, Mozart, Beethoven)',
          soundChar: 'ประณีต ลึกซึ้ง บทสนทนาระหว่างเครื่องสาย 4 ชิ้นอย่างลงตัว',
          occasion: 'Chamber Music ในห้องฟังขนาดเล็ก งานพิธีอบอุ่น',
          seating: [
            { id: 'sq_v1', name: 'Violin 1', role: 'ผู้นำบทสนทนาและทำนองหลัก', family: 'Strings', tone: 'เสียงสูงสดใส ชวนคุย', x: 30, y: 40 },
            { id: 'sq_v2', name: 'Violin 2', role: 'ผู้รับคำและสอดประสาน', family: 'Strings', tone: 'ช่วยเติมเต็มฮาร์โมนี', x: 40, y: 65 },
            { id: 'sq_va', name: 'Viola', role: 'ผู้ให้ความอบอุ่นช่วงกลาง', family: 'Strings', tone: 'เสียงทุ้มกลางลึกซึ้ง', x: 60, y: 65 },
            { id: 'sq_vc', name: 'Cello', role: 'ฐานรากเสียงทุ้มต่ำ', family: 'Strings', tone: 'เสียงเบสทุ้มกังวานรองรับทุกคน', x: 70, y: 40 }
          ]
        }
      }
    }
  },

  // เสียงดนตรีสังเคราะห์จำลอง (Audio Timbre Synthesizer ผ่าน Web Audio API)
  playSample(instId) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const t = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // ปรับแต่งคลื่นเสียงและฮาร์มอนิกส์ตามธรรมชาติของเครื่องดนตรี
      if (instId.includes('ranat') || instId.includes('ponglang')) {
        // เครื่องตีไม้: transient เร็ว หางเสียงสั้น
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, t); // E5
        gain.gain.setValueAtTime(0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t);
        osc.stop(t + 0.36);
      } else if (instId.includes('saw') || instId.includes('violin') || instId.includes('string')) {
        // เครื่องสี: คลื่นฟันปลา sawtooth หวานลากยาว
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, t); // A4
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.4, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
        osc.start(t);
        osc.stop(t + 1.25);
      } else if (instId.includes('khlui') || instId.includes('woodwind')) {
        // เครื่องเป่า: sine นุ่มนวล โหยหวน
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, t); // C5
        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.5, t + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
        osc.start(t);
        osc.stop(t + 1.45);
      } else if (instId.includes('ching')) {
        // ฉิ่ง: เสียงแหลมกังวานใสพิเศษ
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2093, t); // C7
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        osc.start(t);
        osc.stop(t + 0.95);
      } else {
        // เสียงทั่วไป
        osc.type = 'sine';
        osc.frequency.setValueAtTime(329.63, t); // E4
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.start(t);
        osc.stop(t + 0.52);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
    } catch (e) {
      console.log('Audio preview error', e);
    }
  },

  openModal(defaultCategory = 'thai', ensembleKey = null) {
    const modal = document.getElementById('modal-ensemble-explorer');
    if (!modal) return;

    this.activeCategory = defaultCategory;
    const catData = this.data[defaultCategory];
    const keys = Object.keys(catData.ensembles);
    this.activeEnsembleKey = ensembleKey && catData.ensembles[ensembleKey] ? ensembleKey : keys[0];
    this.selectedInstrument = null;

    modal.classList.add('active');
    this.render();
  },

  closeModal() {
    const modal = document.getElementById('modal-ensemble-explorer');
    if (modal) modal.classList.remove('active');
  },

  switchCategory(catKey) {
    this.activeCategory = catKey;
    const catData = this.data[catKey];
    this.activeEnsembleKey = Object.keys(catData.ensembles)[0];
    this.selectedInstrument = null;
    this.render();
  },

  selectEnsemble(key) {
    this.activeEnsembleKey = key;
    this.selectedInstrument = null;
    this.render();
  },

  selectInstrument(inst) {
    this.selectedInstrument = inst;
    this.playSample(inst.id);
    this.renderInspector();
  },

  render() {
    const cat = this.data[this.activeCategory];
    const ens = cat.ensembles[this.activeEnsembleKey];
    if (!ens) return;

    // 1. Render Category Tabs
    ['thai', 'folk', 'western'].forEach(k => {
      const btn = document.getElementById(`ens-cat-${k}`);
      if (btn) btn.className = `academic-tab-btn ${this.activeCategory === k ? 'active' : ''}`;
    });

    // 2. Render Ensemble Selector Pills
    const selectorContainer = document.getElementById('ensemble-pills-selector');
    if (selectorContainer) {
      selectorContainer.innerHTML = Object.entries(cat.ensembles).map(([k, e]) => `
        <button type="button" class="btn-nav-action ${this.activeEnsembleKey === k ? 'primary' : ''}" style="font-size:0.82rem; padding:4px 12px;" onclick="EnsembleExplorer.selectEnsemble('${k}')">
          ${e.name}
        </button>
      `).join('');
    }

    // 3. Render Ensemble Info Banner
    const infoEl = document.getElementById('ensemble-info-banner');
    if (infoEl) {
      infoEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <h3 style="margin:0; font-size:1.15rem; color:#1e3a8a; font-weight:800;">${ens.name}</h3>
            <div style="font-size:0.82rem; color:#475569; margin-top:2px;">ยุค/ที่มา: <strong>${ens.era}</strong> • โอกาสที่ใช้: ${ens.occasion}</div>
          </div>
          <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:4px 10px; font-size:0.8rem; color:#1d4ed8;">
            🔊 <strong>สีสันของเสียง (Timbre):</strong> ${ens.soundChar}
          </div>
        </div>
      `;
    }

    // 4. Render Visual Stage Seating Chart
    const stageEl = document.getElementById('ensemble-stage-canvas');
    if (stageEl) {
      stageEl.innerHTML = `
        <div style="position:relative; width:100%; height:320px; background:radial-gradient(circle at center, #f8fafc 40%, #e2e8f0 100%); border:2px solid #cbd5e1; border-radius:12px; overflow:hidden;">
          <!-- Stage Footlight Arc -->
          <div style="position:absolute; bottom:0; left:5%; width:90%; height:35px; border-top:3px dashed #94a3b8; border-radius:50% 50% 0 0; opacity:0.6;"></div>
          <div style="position:absolute; bottom:6px; left:50%; transform:translateX(-50%); font-size:0.75rem; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:1px;">
            🎭 ด้านหน้าเวที (Audience / ด้านหน้าผู้ฟัง)
          </div>

          <!-- Seating Nodes -->
          ${ens.seating.map((inst, idx) => `
            <div onclick="EnsembleExplorer.selectInstrument(EnsembleExplorer.data['${this.activeCategory}'].ensembles['${this.activeEnsembleKey}'].seating[${idx}])"
                 style="position:absolute; left:${inst.x}%; top:${inst.y}%; transform:translate(-50%, -50%); cursor:pointer; text-align:center; transition:transform 0.15s ease;"
                 onmouseover="this.style.transform='translate(-50%, -50%) scale(1.1)'"
                 onmouseout="this.style.transform='translate(-50%, -50%) scale(1)'">
              <div style="width:42px; height:42px; border-radius:50%; background:${this.selectedInstrument?.id === inst.id ? '#2563eb' : '#ffffff'}; border:2px solid ${this.selectedInstrument?.id === inst.id ? '#1d4ed8' : '#3b82f6'}; box-shadow:0 2px 6px rgba(0,0,0,0.12); display:flex; align-items:center; justify-content:center; margin:0 auto; color:${this.selectedInstrument?.id === inst.id ? '#ffffff' : '#1e3a8a'}; font-weight:800; font-size:0.85rem;">
                ${idx + 1}
              </div>
              <div style="font-size:0.75rem; font-weight:700; color:#1e293b; background:rgba(255,255,255,0.9); padding:1px 6px; border-radius:4px; margin-top:3px; white-space:nowrap; border:1px solid #e2e8f0;">
                ${inst.name}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    this.renderInspector();
  },

  renderInspector() {
    const inspectorEl = document.getElementById('ensemble-instrument-inspector');
    if (!inspectorEl) return;

    if (!this.selectedInstrument) {
      inspectorEl.innerHTML = `
        <div style="text-align:center; padding:1.5rem; color:#64748b; background:#f8fafc; border-radius:8px; border:1px dashed #cbd5e1;">
          👉 <strong>แตะที่เครื่องดนตรีบนผังเวที</strong> เพื่อฟังเสียงจำลองและศึกษาบทบาทหน้าที่ในวง (Indicator ศ 2.1 ม.1/4)
        </div>
      `;
      return;
    }

    const inst = this.selectedInstrument;
    inspectorEl.innerHTML = `
      <div style="background:#ffffff; border:1.5px solid #3b82f6; border-radius:8px; padding:1rem; box-shadow:0 3px 8px rgba(37,99,235,0.08);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <div>
            <span style="font-size:0.75rem; background:#dbeafe; color:#1e40af; font-weight:700; padding:2px 8px; border-radius:4px;">
              ${inst.family}
            </span>
            <h4 style="margin:4px 0 0; font-size:1.15rem; color:#1e3a8a; font-weight:800;">${inst.name}</h4>
          </div>
          <button type="button" class="btn-nav-action primary" onclick="EnsembleExplorer.playSample('${inst.id}')" style="display:inline-flex; align-items:center; gap:4px;">
            🔊 ฟังเสียงตัวอย่าง (Sample)
          </button>
        </div>
        <div style="font-size:0.85rem; line-height:1.6; color:#334155;">
          <div>🎯 <strong>บทบาทหน้าที่ในวง:</strong> ${inst.role}</div>
          <div style="margin-top:2px;">🎨 <strong>เอกลักษณ์ของเสียง (Timbre):</strong> ${inst.tone}</div>
        </div>
      </div>
    `;
  },

  // มินิเกมทดสอบโสตทักษะ (Audio Quiz)
  startQuiz() {
    const qList = [
      { q: "วงดนตรีไทยประเภทใดที่มีเครื่องดนตรีครบทั้ง ดีด สี ตี และเป่า บรรเลงร่วมกันอย่างกลมกลืน?", a: "วงมโหรี", choices: ["วงปี่พาทย์ไม้แข็ง", "วงเครื่องสาย", "วงมโหรี", "วงปี่พาทย์มอญ"] },
      { q: "เครื่องดนตรีชิ้นใดทำหน้าที่เป็น 'เครื่องนำทำนอง' และเปรียบเสมือนหัวหน้าวงในวงปี่พาทย์ไม้แข็ง?", a: "ระนาดเอก", choices: ["ฆ้องวงใหญ่", "ระนาดเอก", "ปี่ใน", "ตะโพน"] },
      { q: "วงดนตรีพื้นบ้านล้านนาของจังหวัดพะเยาที่มีสะล้อ ซึง และปี่จุม เรียกว่าวงอะไร?", a: "วงสะล้อซอซึง", choices: ["วงกลองยาว", "วงสะล้อซอซึง", "วงโปงลาง", "วงรองเง็ง"] },
      { q: "ในวงดุริยางค์ซิมโฟนีสากล เครื่องสายชิ้นใดทำหน้าที่เป็นแนวเสียงเบสต่ำสุดรองรับฮาร์โมนี?", a: "Double Bass", choices: ["Violin 1", "Viola", "Cello", "Double Bass"] },
      { q: "เครื่องประกอบจังหวะชิ้นใดของไทยที่มีหน้าที่ 'กำกับหน้าทับและคุมอัตราจังหวะ' ให้วงบรรเลงพร้อมเพรียง?", a: "ฉิ่ง", choices: ["ฉิ่ง", "กรับ", "ฉาบ", "โหม่ง"] }
    ];
    const rand = qList[Math.floor(Math.random() * qList.length)];
    const chosen = prompt(`🎧 มินิเกมทดสอบความรู้วงดนตรี (Active Quiz):\n\n${rand.q}\n\nตัวเลือก: ${rand.choices.join(' | ')}\n\n(พิมพ์คำตอบลงในช่องด้านล่าง):`);
    if (!chosen) return;
    if (chosen.trim() === rand.a) {
      alert(`🎉 ถูกต้องยอดเยี่ยม! คำตอบคือ "${rand.a}" เก่งมากครับ!`);
    } else {
      alert(`💡 คำตอบที่ถูกต้องคือ "${rand.a}" ครับ ลองศึกษาผังวงเพิ่มเติมดูนะครับ!`);
    }
  }
};

if (typeof window !== 'undefined') {
  window.EnsembleExplorer = EnsembleExplorer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnsembleExplorer;
}

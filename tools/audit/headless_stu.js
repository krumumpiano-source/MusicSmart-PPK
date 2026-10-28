const {chromium}=(function(){try{return require('playwright-core')}catch(e){return require(process.env.PW_CORE||'/workspace/bt/node_modules/playwright-core')}})();
const BAN=[/ℹ/,/ร่างโดยระบบ/,/รอครูตรวจ/,/ยังไม่ได้โหลดเข้าแอป/,/วก\.5 ไม่ระบุ/,/ครูโปรดยืนยัน/,/ระบบตั้งเป็น/,/Do-Re-Mi|โด[\s-]*เร[\s-]*มี/i,/ส่งเข้า Google Drive ครู/,/ข้อสังเกตสำหรับครู/,/ฉบับร่าง/,/สมมติฐาน/];
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 const res=[];
 for(const [w,h] of [[360,640],[1024,768]]){
  const p=await b.newPage({viewport:{width:w,height:h}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8893/index.html');await p.waitForTimeout(1500);
  const ok=await p.evaluate(async()=>{var cls=Store.getAllClasses('M1');var st=Store.getStudents(cls[0]);var sid=st[0].student_id;var r=Store.registerStudentPin(sid,'246810');var a=document.getElementById('modal-auth-login');if(a)a.classList.remove('active');App.switchRole('student',false);return {sid:sid,r:r&&r.success,cls:cls[0]};});
  console.log(w,JSON.stringify(ok));
  for(let per=1;per<=20;per++){
    await p.evaluate(per=>{App.state.role='student';App.selectStudentPeriod(per);},per);
    await p.waitForTimeout(350);
    const m=await p.evaluate(()=>{
      const v=document.getElementById('view-student');const vis=e=>e&&e.offsetParent!==null;
      const txt=v.innerText||'';
      const box=document.getElementById('student-submission-box');
      const up=document.getElementById('student-upload-block');
      const q=[...v.querySelectorAll('*')].filter(e=>vis(e)&&e.children.length<4&&/แบบทดสอบ/.test(e.textContent||'')&&e.textContent.length<140).map(e=>e.textContent.trim().slice(0,60));
      const btns=[...v.querySelectorAll('button,a.btn,.media-btn,[onclick]')].filter(vis).map(e=>(e.innerText||'').trim().replace(/\s+/g,' ').slice(0,50)).filter(Boolean);
      return {txt:txt,box:vis(box),upload:vis(up),pol:App.state._pol?{kind:App.state._pol.kind,prac:!!App.state._pol.practiceQuiz}:null,title:(document.getElementById('student-workspace-title')||{}).textContent,quizTexts:q.slice(0,4),btns:btns,hover:document.documentElement.scrollWidth>innerWidth,prompt:((document.getElementById('student-assignment-prompt')||{}).innerText||'').slice(0,100),maxs:(document.getElementById('student-assignment-max-score')||{}).textContent};
    });
    const bad=BAN.filter(r=>r.test(m.txt)).map(String);
    res.push({w,per,kind:m.pol&&m.pol.kind,box:m.box,upload:m.upload,prac:m.pol&&m.pol.prac,title:m.title,bad,hover:m.hover,quiz:m.quizTexts,maxs:m.maxs,btns:m.btns.length});
    if(w===360 && [1,2,7,11].includes(per)){
      await p.evaluate(()=>{var v=document.getElementById('student-workspace-title');if(v)v.scrollIntoView();});
      await p.screenshot({path:`/workspace/shots/stu/student_p${per}_360.png`,fullPage:true});
    }
    if(w===1024 && [1,2,7,11].includes(per)) await p.screenshot({path:`/workspace/shots/stu/student_p${per}_1024.png`,fullPage:true});
  }
  console.log('errs',errs.slice(0,5));await p.close();
 }
 require('fs').writeFileSync('/workspace/shots/stu/student_matrix.json',JSON.stringify(res,null,1));
 res.filter(r=>r.w===360).forEach(r=>console.log(r.per,r.kind,'box='+r.box,'up='+r.upload,'prac='+r.prac,r.maxs,'bad='+r.bad.join(''),'hov='+r.hover,JSON.stringify(r.quiz)));
 await b.close();
})();

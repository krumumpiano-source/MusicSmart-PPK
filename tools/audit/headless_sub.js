const {chromium}=(function(){try{return require('playwright-core')}catch(e){return require(process.env.PW_CORE||'/workspace/bt/node_modules/playwright-core')}})();
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:360,height:640}});
p.on('dialog',d=>d.accept());
await p.goto('http://localhost:8893/index.html');await p.waitForTimeout(1500);
await p.evaluate(()=>{Store.registerStudentPin('90001','246810');document.getElementById('modal-auth-login').classList.remove('active');App.switchRole('student',false);});
const out=[];
for(const per of [12,13,14,15]){
  await p.evaluate(n=>App.selectStudentPeriod(n),per);
  await p.fill('#student-submission-text','ทดสอบส่งงานคาบ '+per);
  await p.click('#student-submission-box button.primary');
  await p.waitForTimeout(400);
  out.push(await p.evaluate(n=>{var all=Store.getAllSubmissions();var ks=Object.keys(all).filter(k=>k.indexOf('_p'+n+'_90001')>0);var r=ks.length?all[ks[0]]:null;return {per:n,keys:ks,rec:r&&{cls:r.className,type:r.submissionType,status:r.status,content:r.content,dev:r.deviceNo},ts:document.getElementById('student-submission-timestamp').textContent.trim().slice(0,50),pol:App.state._pol&&{kind:App.state._pol.kind,scored:App.state._pol.task&&App.state._pol.task.scored,max:App.state._pol.maxScore}}},per));
}
console.log(JSON.stringify(out,null,1));
await b.close();})();

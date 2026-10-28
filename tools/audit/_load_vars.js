/* โหลดตัวแปรจากไฟล์ data/*.js (const/var/window.X) ผ่าน vm โดยไม่แตะ global ของ node */
const vm=require('vm'),fs=require('fs');
function loadVars(f,names){const c=vm.createContext({console,setTimeout,clearTimeout,localStorage:{getItem(){return null},setItem(){},removeItem(){}}});c.window=c;c.self=c;vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});const o={};names.forEach(n=>{try{o[n]=vm.runInContext('typeof '+n+'!=="undefined"?'+n+':undefined',c)}catch(e){}});return o}
module.exports=loadVars;

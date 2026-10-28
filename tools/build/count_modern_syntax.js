#!/usr/bin/env node
/* นับไวยากรณ์ JS ใหม่ (ที่เบราว์เซอร์/WebView เก่าอ่านไม่ออก) ในไฟล์ app — ใช้ acorn (ต้อง `npm i --no-save acorn acorn-walk`)
 * ใช้: node tools/build/count_modern_syntax.js [โฟลเดอร์หรือไฟล์ ...]   (ค่าเริ่มต้น app/js app/data) */
'use strict';
const fs = require('fs'), path = require('path');
let acorn, walk;
try { acorn = require('acorn'); walk = require('acorn-walk'); } catch (e) { console.error('ต้องติดตั้ง: npm i --no-save acorn acorn-walk'); process.exit(2); }
const KEYS = [
  ['optionalChain', 'Optional chaining ?.', 'Chrome 80 / Safari 13.1'],
  ['nullish', 'Nullish ??', 'Chrome 80 / Safari 13.1'],
  ['logicalAssign', 'Logical assignment ||= &&= ??=', 'Chrome 85'],
  ['objectSpread', 'Object spread/rest {...x}', 'Chrome 60'],
  ['asyncFn', 'async/await', 'Chrome 55'],
  ['asyncIter', 'for await / async generator', 'Chrome 63'],
  ['template', 'Template literal `…`', 'Chrome 41'],
  ['arrow', 'Arrow function', 'Chrome 45'],
  ['classDecl', 'class', 'Chrome 49'],
  ['letConst', 'let / const', 'Chrome 49'],
  ['destructuring', 'Destructuring', 'Chrome 49'],
  ['spreadCall', 'Spread [...x] / f(...x)', 'Chrome 46'],
  ['defaultParam', 'Default parameters', 'Chrome 49'],
  ['expOp', 'Exponent **', 'Chrome 52'],
  ['optCatch', 'catch { } (ไม่มีตัวแปร)', 'Chrome 66'],
  ['bigint', 'BigInt literal', 'Chrome 67'],
  ['numSep', 'Numeric separator 1_000', 'Chrome 75'],
  ['regexNamed', 'Regex named group / lookbehind', 'Chrome 62/64']
];
function scan(src) {
  const c = {}; KEYS.forEach(k => c[k[0]] = 0);
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true, allowHashBang: true });
  const add = k => { c[k]++; };
  walk.full(ast, n => {
    switch (n.type) {
      case 'ChainExpression': add('optionalChain'); break;
      case 'LogicalExpression': if (n.operator === '??') add('nullish'); break;
      case 'AssignmentExpression': if (/^(\|\||&&|\?\?)=$/.test(n.operator)) add('logicalAssign'); if (n.left.type === 'ObjectPattern' || n.left.type === 'ArrayPattern') add('destructuring'); break;
      case 'SpreadElement': add('spreadCall'); break;
      case 'ObjectExpression': n.properties.forEach(p => { if (p.type === 'SpreadElement') { c.spreadCall--; c.objectSpread++; } }); break;
      case 'RestElement': break;
      case 'TemplateLiteral': add('template'); break;
      case 'ArrowFunctionExpression': add('arrow'); if (n.async) add('asyncFn'); n.params.forEach(p => { if (p.type === 'AssignmentPattern') add('defaultParam'); if (p.type.indexOf('Pattern') > 0 && p.type !== 'AssignmentPattern') add('destructuring'); }); break;
      case 'FunctionDeclaration': case 'FunctionExpression': if (n.async) add('asyncFn'); if (n.async && n.generator) add('asyncIter'); n.params.forEach(p => { if (p.type === 'AssignmentPattern') add('defaultParam'); if (p.type === 'ObjectPattern' || p.type === 'ArrayPattern') add('destructuring'); }); break;
      case 'ForOfStatement': if (n.await) add('asyncIter'); break;
      case 'ClassDeclaration': case 'ClassExpression': add('classDecl'); break;
      case 'VariableDeclaration': if (n.kind !== 'var') add('letConst'); n.declarations.forEach(d => { if (d.id.type === 'ObjectPattern' || d.id.type === 'ArrayPattern') add('destructuring'); }); break;
      case 'CatchClause': if (!n.param) add('optCatch'); break;
      case 'BinaryExpression': if (n.operator === '**') add('expOp'); break;
      case 'AssignmentPattern': break;
      case 'Literal': if (n.bigint) add('bigint'); if (n.raw && /\d_\d/.test(n.raw) && typeof n.value === 'number') add('numSep'); if (n.regex && /\(\?<[=!a-zA-Z]/.test(n.regex.pattern)) add('regexNamed'); break;
    }
  });
  return c;
}
function files(args) {
  const out = [];
  args.forEach(a => {
    if (!fs.existsSync(a)) return;
    const st = fs.statSync(a);
    if (st.isDirectory()) fs.readdirSync(a).filter(f => /\.js$/.test(f)).forEach(f => out.push(path.join(a, f)));
    else out.push(a);
  });
  return out;
}
const args = process.argv.slice(2); if (!args.length) args.push('app/js', 'app/data');
const total = {}; KEYS.forEach(k => total[k[0]] = 0);
const rows = [];
files(args).forEach(f => {
  let c; try { c = scan(fs.readFileSync(f, 'utf8')); } catch (e) { rows.push({ f, err: e.message }); return; }
  KEYS.forEach(k => total[k[0]] += c[k[0]]);
  rows.push({ f, c });
});
console.log('| ไวยากรณ์ | จำนวนรวม | ต้องใช้เบราว์เซอร์ตั้งแต่ |\n|---|---|---|');
KEYS.forEach(k => console.log('| ' + k[1] + ' | ' + total[k[0]] + ' | ' + k[2] + ' |'));
console.log('\nรายไฟล์ที่ใช้ไวยากรณ์ใหม่ระดับ Chrome ≥ 60 (?. ?? object-spread):');
rows.forEach(r => { if (r.err) { console.log('  ! ' + r.f + ' parse error: ' + r.err); return; } const n = r.c.optionalChain + r.c.nullish + r.c.objectSpread + r.c.logicalAssign; if (n) console.log('  ' + r.f + ': ?.=' + r.c.optionalChain + ' ??=' + r.c.nullish + ' {...}=' + r.c.objectSpread); });

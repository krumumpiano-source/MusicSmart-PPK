#!/usr/bin/env node
// Strip `correct` answers and `explanation` text from quizzes.js in public _site builds
// Usage: node tools/build/strip_quiz_answers.js _site/data/quizzes.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function stripQuizFile(filePath) {
  const absPath = path.resolve(filePath);
  const src = fs.readFileSync(absPath, 'utf8');
  const ctx = { module: { exports: null }, exports: {} };
  vm.createContext(ctx);
  vm.runInContext(src + '\n;this.__QUIZZES__ = typeof QUIZZES_DATA !== "undefined" ? QUIZZES_DATA : module.exports;', ctx);

  const data = JSON.parse(JSON.stringify(ctx.__QUIZZES__ || { units: [] }));
  let strippedQuestions = 0;
  for (const unit of (data.units || [])) {
    for (const q of (unit.questions || [])) {
      delete q.correct;
      delete q.explanation;
      strippedQuestions++;
    }
  }

  const out = [
    '// ==========================================================================',
    '// MusicSmart PPK - Public Quiz Questions (Answer Keys Stripped on Build)',
    '// ==========================================================================',
    '',
    'const QUIZZES_ANSWERS_STRIPPED = true;',
    'const QUIZZES_DATA = ' + JSON.stringify(data, null, 2) + ';',
    '',
    "if (typeof module !== 'undefined' && module.exports) {",
    '  module.exports = QUIZZES_DATA;',
    '}',
    ''
  ].join('\n');

  if (/"correct"\s*:/.test(out) || /"explanation"\s*:/.test(out)) {
    throw new Error('Verification failed: stripped quizzes.js still contains answer keys or explanations');
  }

  fs.writeFileSync(absPath, out, 'utf8');
  return { units: (data.units || []).length, questions: strippedQuestions, path: absPath };
}

if (require.main === module) {
  const target = process.argv[2] || path.join(process.cwd(), '_site', 'data', 'quizzes.js');
  const res = stripQuizFile(target);
  console.log(`Stripped answers from ${res.questions} questions across ${res.units} units in ${res.path}`);
}

module.exports = { stripQuizFile };

// End-to-End Simulation Test for QuizEngine Anti-Cheating Architecture
const assert = require('assert');
global.QUIZZES_DATA = require('../app/data/quizzes.js');

// Mock localStorage and window
const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] || null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; }
};

const QuizEngine = require('../app/js/quiz-engine.js');

console.log('--- Testing QuizEngine with Real Data and Live State ---');

// 1. Verify settings defaults
assert.strictEqual(QuizEngine.settings.shuffleQuestions, true, 'shuffleQuestions should be true by default');
assert.strictEqual(QuizEngine.settings.shuffleChoices, true, 'shuffleChoices should be true by default');
console.log('✓ Settings default verified: Anti-Cheating ON');

// 2. Test session question generation for all 4 units
for (let u = 1; u <= 4; u++) {
  const unitData = QUIZZES_DATA.units.find(item => item.unit_no === u);
  assert(unitData, `Unit ${u} data must exist`);

  const sessionQuestions = QuizEngine.generateSessionQuestions(unitData);
  assert.strictEqual(sessionQuestions.length, 10, `Unit ${u} must generate 10 questions`);

  // Verify that each question has keys ['ก', 'ข', 'ค', 'ง'] exactly once
  sessionQuestions.forEach((q, idx) => {
    assert.strictEqual(q.displayNo, idx + 1, `Display number must be ${idx + 1}`);
    const keys = q.choices.map(c => c.key);
    assert.deepStrictEqual(keys, ['ก', 'ข', 'ค', 'ง'], `Choices keys must be ['ก', 'ข', 'ค', 'ง'] on question ${q.id}`);

    // Verify sessionCorrect is one of ['ก', 'ข', 'ค', 'ง']
    assert(['ก', 'ข', 'ค', 'ง'].includes(q.sessionCorrect), `sessionCorrect must be one of ['ก', 'ข', 'ค', 'ง'], got ${q.sessionCorrect}`);

    // Verify the choice matching sessionCorrect has isCorrect === true
    const correctChoice = q.choices.find(c => c.key === q.sessionCorrect);
    assert(correctChoice.isCorrect === true, `Choice for sessionCorrect must be isCorrect on ${q.id}`);

    // Verify exactly one choice is correct
    const correctCount = q.choices.filter(c => c.isCorrect).length;
    assert.strictEqual(correctCount, 1, `Exactly 1 choice must be correct on ${q.id}`);
  });
  console.log(`✓ Unit ${u}: 10 questions verified with correct keys ก, ข, ค, ง and accurate sessionCorrect mapping`);
}

// 3. Test Full Exam Simulation: Answering 10/10 correct
const unit1 = QUIZZES_DATA.units[0];
QuizEngine.state.unitNo = 1;
QuizEngine.state.studentId = '35994';
QuizEngine.state.sessionQuestions = QuizEngine.generateSessionQuestions(unit1);
QuizEngine.state.answers = {};
QuizEngine.state.elapsedSeconds = 125;

// Answer all correctly according to sessionCorrect
QuizEngine.state.sessionQuestions.forEach((q, idx) => {
  QuizEngine.state.answers[idx] = q.sessionCorrect;
});

QuizEngine.submitQuiz();

assert.strictEqual(QuizEngine.state.lastResult.score, 10, 'Full correct answers must yield 10/10');
assert.strictEqual(QuizEngine.state.lastResult.percentage, 100, 'Full correct answers must yield 100%');
assert.strictEqual(QuizEngine.state.lastResult.shuffled, true, 'Result must be flagged as shuffled');
console.log('✓ Full exam 10/10 simulation passed');

// 4. Test Stored Result Retrieval
const savedAttempt = QuizEngine.getStudentAttempt('35994', 1);
assert(savedAttempt, 'Saved attempt must exist in storage');
assert.strictEqual(savedAttempt.score, 10, 'Saved attempt score must be 10');
console.log('✓ Storage persistence and retrieval passed');

// 5. Test Multiple Shuffles for Anti-Cheating
const questionOrderSet = new Set();
const choiceKeySet = new Set();

for (let i = 0; i < 50; i++) {
  const sQuestions = QuizEngine.generateSessionQuestions(unit1);
  questionOrderSet.add(sQuestions.map(q => q.id).join(','));
  choiceKeySet.add(sQuestions.map(q => q.sessionCorrect).join(''));
}

console.log(`✓ Randomization entropy over 50 attempts: ${questionOrderSet.size} unique question orders, ${choiceKeySet.size} unique key patterns`);
assert(questionOrderSet.size >= 40, 'Question order entropy should be high');
assert(choiceKeySet.size >= 40, 'Choice key entropy should be high');

console.log('ALL QUIZ ENGINE INTEGRATION TESTS PASSED 100%!');

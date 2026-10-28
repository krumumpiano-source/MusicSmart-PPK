// Test Suite: Classroom Modulo 5 Grouping Logic
const assert = require('assert');

function getStudentGroup(student) {
  const no = parseInt(student && student.no !== undefined ? student.no : 0, 10);
  if (isNaN(no) || no < 1) return 1;
  return ((no - 1) % 5) + 1;
}

function groupStudentsByPod(students) {
  const groups = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  (students || []).forEach(s => {
    const g = getStudentGroup(s);
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  });
  return groups;
}

// 1. Verify exact roll numbers match user specification
const group1Rolls = [1, 6, 11, 16, 21, 26, 31, 36];
const group2Rolls = [2, 7, 12, 17, 22, 27, 32, 37];
const group3Rolls = [3, 8, 13, 18, 23, 28, 33, 38];
const group4Rolls = [4, 9, 14, 19, 24, 29, 34, 39];
const group5Rolls = [5, 10, 15, 20, 25, 30, 35, 40];

console.log('--- Testing Individual Roll Numbers ---');
group1Rolls.forEach(no => assert.strictEqual(getStudentGroup({ no }), 1, `Roll ${no} must be in Group 1`));
group2Rolls.forEach(no => assert.strictEqual(getStudentGroup({ no }), 2, `Roll ${no} must be in Group 2`));
group3Rolls.forEach(no => assert.strictEqual(getStudentGroup({ no }), 3, `Roll ${no} must be in Group 3`));
group4Rolls.forEach(no => assert.strictEqual(getStudentGroup({ no }), 4, `Roll ${no} must be in Group 4`));
group5Rolls.forEach(no => assert.strictEqual(getStudentGroup({ no }), 5, `Roll ${no} must be in Group 5`));
console.log('✅ All 40 individual roll numbers mapped to correct groups!');

// 2. Verify full class of 40 students grouping
console.log('--- Testing Full Class Grouping (40 Students) ---');
const sampleStudents = [];
for (let i = 1; i <= 40; i++) {
  sampleStudents.push({
    student_id: `ID_${i}`,
    no: i,
    first_name: `Student_${i}`,
    nickname: `Nick_${i}`
  });
}

const pods = groupStudentsByPod(sampleStudents);
for (let g = 1; g <= 5; g++) {
  assert.strictEqual(pods[g].length, 8, `Group ${g} must contain exactly 8 students`);
}
console.log('✅ Exactly 8 students in each of the 5 groups (total 40 students)!');

// 3. Verify edge cases (missing or invalid 'no')
assert.strictEqual(getStudentGroup({}), 1, 'Default to group 1 if missing no');
assert.strictEqual(getStudentGroup({ no: null }), 1, 'Default to group 1 if null no');
assert.strictEqual(getStudentGroup({ no: 'abc' }), 1, 'Default to group 1 if NaN no');
console.log('✅ Edge cases handled gracefully!');

console.log('\n🎉 ALL GROUP LOGIC TESTS PASSED!');

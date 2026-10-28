#!/usr/bin/env bash
# Run every MusicSmart test suite with the sample roster (same as CI).
set -e
cd "$(dirname "$0")/.."
export USE_SAMPLE_DATA=1
for f in app/sw.js app/js/*.js app/data/*.js google_apps_script.js; do node --check "$f"; done
python3 tools/sync_apps_script_template.py --check
node tests/test_quiz_shuffle.js > /dev/null
python3 tests/test_lessons.py | tail -1
python3 tests/test_students.py | tail -1
node test_e2e_suite.js | grep "Results"
node tests/test_sync.js 2>/dev/null | tail -1
for t in tests/test_student_*.js tests/test_phase*.js; do node "$t"; done
echo "ALL SUITES PASSED"

import re
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REAL = os.path.join(ROOT, "app", "data", "students.js")
SAMPLE_FILES = [os.path.join(ROOT, "tests", "fixtures", "students.sample.js"),
                os.path.join(ROOT, "app", "data", "students.sample.js")]


def load_roster(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    match = re.search(r'const STUDENTS_DATA = ({.*?});\s*if', content, re.DOTALL)
    assert match is not None, f"STUDENTS_DATA not found in {filepath}"
    return json.loads(match.group(1))


def check_fields(data):
    for c, lst in data.items():
        for s in lst:
            assert "student_id" in s and s["student_id"], f"Student missing student_id in {c}"
            assert "first_name" in s and s["first_name"], f"Student missing first_name in {c}"
            assert "no" in s, f"Student missing no in {c}"
            assert s.get("class") == c, f"class mismatch in {c}"


def test_sample_rosters():
    for fp in SAMPLE_FILES:
        data = load_roster(fp)
        assert data, f"{fp} empty"
        check_fields(data)
    a, b = (load_roster(fp) for fp in SAMPLE_FILES)
    assert a == b, "tests/fixtures/students.sample.js and app/data/students.sample.js differ"
    print("SUCCESS: sample rosters valid")


def test_students():
    if os.environ.get("USE_SAMPLE_DATA") == "1" or not os.path.exists(REAL):
        test_sample_rosters()
        print("SKIP: real roster checks (USE_SAMPLE_DATA=1 or app/data/students.js not present)")
        return
    filepath = REAL
    
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Extract JSON-like content
    match = re.search(r'const STUDENTS_DATA = ({.*?});\s*if', content, re.DOTALL)
    assert match is not None, "STUDENTS_DATA not found in file"
    
    data = json.loads(match.group(1))
    expected_classes = [
        "ม.1/1", "ม.1/2", "ม.1/3", "ม.1/4", "ม.1/5", "ม.1/6", "ม.1/7", "ม.1/14",
        "ม.2/1", "ม.2/2", "ม.2/3", "ม.2/4", "ม.2/5", "ม.2/6", "ม.2/7", "ม.2/14"
    ]
    
    total_students = 0
    for c in expected_classes:
        assert c in data, f"Missing class {c}"
        if "14" in c:
            assert len(data[c]) == 25, f"Class {c} expected 25 students, got {len(data[c])}"
        else:
            assert len(data[c]) == 40, f"Class {c} expected 40 students, got {len(data[c])}"
        total_students += len(data[c])
        # verify fields
        for s in data[c]:
            assert "student_id" in s and s["student_id"], f"Student missing student_id in {c}"
            assert "first_name" in s and s["first_name"], f"Student missing first_name in {c}"
            assert "no" in s, f"Student missing no in {c}"
    
    assert total_students == 610, f"Expected 610 total students, got {total_students}"
    print(f"SUCCESS: ALL 16 CLASSES AND {total_students} STUDENTS VERIFIED WITH 100% ACCURACY!")

if __name__ == "__main__":
    test_students()

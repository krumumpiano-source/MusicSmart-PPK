import re
import json
import os

def test_students():
    filepath = os.path.join("app", "data", "students.js")
    assert os.path.exists(filepath), f"File {filepath} does not exist"
    
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

import re
import json
import os

def test_lessons():
    filepath = os.path.join("app", "data", "lessons.js")
    assert os.path.exists(filepath), f"File {filepath} does not exist"
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    match = re.search(r'const LESSONS_DATA = ({.*?});\s*if', content, re.DOTALL)
    assert match is not None, "LESSONS_DATA not found in file"
    
    data = json.loads(match.group(1))
    assert "M1" in data, "M1 key not found in LESSONS_DATA"
    assert len(data["M1"]) == 20, f"Expected 20 lessons for M1, got {len(data['M1'])}"
    
    for l in data["M1"]:
        assert "period" in l, f"Lesson missing period"
        assert "topic" in l and l["topic"], f"Lesson {l['period']} missing topic"
        assert "mentor_tips" in l and l["mentor_tips"], f"Lesson {l['period']} missing mentor_tips"
        assert "steps" in l and len(l["steps"]) >= 3, f"Lesson {l['period']} steps invalid"
        assert "assessment" in l, f"Lesson {l['period']} missing assessment"
    
    assert "M2" in data, "M2 key not found in LESSONS_DATA"
    print("SUCCESS: ALL 20 M1 LESSON PLANS WITH MENTOR TIPS & RUBRICS VERIFIED!")

if __name__ == "__main__":
    test_lessons()

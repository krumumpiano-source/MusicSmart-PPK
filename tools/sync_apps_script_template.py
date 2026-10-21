"""Copy google_apps_script.js into the APPS_SCRIPT_CODE template in app/js/google-sheet-sync.js
so the in-app "1-Click Copy" always matches the real backend. Run after editing google_apps_script.js.
Usage: python tools/sync_apps_script_template.py [--check]"""
import pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parent.parent
gas = (ROOT / "google_apps_script.js").read_text(encoding="utf-8")
sync_path = ROOT / "app/js/google-sheet-sync.js"
src = sync_path.read_text(encoding="utf-8")
esc = gas.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
start = src.index("  APPS_SCRIPT_CODE: `") + len("  APPS_SCRIPT_CODE: `")
end = src.index("`\n};", start)
new = src[:start] + esc.rstrip("\n") + src[end:]
if "--check" in sys.argv:
    if new != src:
        sys.exit("APPS_SCRIPT_CODE is out of date: run python tools/sync_apps_script_template.py")
    print("APPS_SCRIPT_CODE up to date")
else:
    sync_path.write_text(new, encoding="utf-8")
    print("updated", sync_path)

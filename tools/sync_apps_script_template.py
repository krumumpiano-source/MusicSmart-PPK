"""Sync google_apps_script.js into lazy-loaded app/data/gas_template.js and keep
EXPECTED_GAS_VERSION in app/js/google-sheet-sync.js up to date.
Run after editing google_apps_script.js.
Usage: python tools/sync_apps_script_template.py [--check]"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
gas = (ROOT / "google_apps_script.js").read_text(encoding="utf-8")
tpl_path = ROOT / "app/data/gas_template.js"
sync_path = ROOT / "app/js/google-sheet-sync.js"

ver_m = re.search(r"var GAS_VERSION = '([^']+)';", gas)
if not ver_m:
    sys.exit("Missing GAS_VERSION in google_apps_script.js")
gas_ver = ver_m.group(1)

esc = gas.rstrip("\n").replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
expected_tpl = (
    "// Auto-generated from google_apps_script.js by tools/sync_apps_script_template.py\n"
    "// Loaded lazily only when a teacher clicks 1-Click Copy Apps Script\n"
    "(function (root) {\n"
    "  var code = `" + esc + "`;\n"
    "  if (root) root.MUSICSMART_GAS_TEMPLATE = code;\n"
    "  if (typeof module !== 'undefined' && module.exports) module.exports = code;\n"
    "})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));\n"
)

sync_src = sync_path.read_text(encoding="utf-8")
expected_sync = re.sub(
    r"EXPECTED_GAS_VERSION:\s*'[^']*'",
    f"EXPECTED_GAS_VERSION: '{gas_ver}'",
    sync_src,
    count=1,
)

if "--check" in sys.argv:
    cur_tpl = tpl_path.read_text(encoding="utf-8") if tpl_path.exists() else ""
    if cur_tpl != expected_tpl:
        sys.exit("app/data/gas_template.js is out of date: run python tools/sync_apps_script_template.py")
    if expected_sync != sync_src or f"EXPECTED_GAS_VERSION: '{gas_ver}'" not in sync_src:
        sys.exit("EXPECTED_GAS_VERSION in app/js/google-sheet-sync.js is out of date: run python tools/sync_apps_script_template.py")
    print("APPS_SCRIPT_CODE up to date")
else:
    tpl_path.write_text(expected_tpl, encoding="utf-8")
    if expected_sync != sync_src:
        sync_path.write_text(expected_sync, encoding="utf-8")
    print("updated", tpl_path, "and synced EXPECTED_GAS_VERSION =", gas_ver)

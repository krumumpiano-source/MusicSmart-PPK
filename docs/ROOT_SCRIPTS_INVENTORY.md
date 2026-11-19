# Root Cleanup & Archive Layout

All historical one-off Python scripts, scratch text/JSON dumps, and school blank forms previously cluttering the repository root have been organized without deleting any work:

- **`archive/legacy_scripts/`** (77 Python scripts): One-off curriculum builders, docx extractors, audits, and migration helpers (`alignment_audit.py` … `verify_updates.py`, `plans_data_korsor4.py`, `build_academic_data.py`, etc.). Active maintained tooling lives in [`tools/`](../tools/).
- **`archive/dumps/`** (20 scratch dumps): Text/JSON inspection outputs and legacy PDPA-ignored local files (`scores.txt`, `raw_user_input.txt`, `*_extracted.json` remain ignored by `.gitignore`).
- **`docs/forms/`** (4 PDF files): Blank official school forms (`วก.3`, `วก.4`, `วก.5`, `วก.7`).
- **`docs/archive/schema_postgres_supabase.sql`**: Superseded PostgreSQL/Supabase draft schema moved out of `app/data/` (production backend uses Cloudflare D1 migrations under `cloudflare-api/migrations/`).

## Root Entry Points Kept Active
- `README.md`, `LOCAL_PREVIEW_TH.md`
- `START_LOCAL.bat`, `เปิดโปรแกรม_MusicSmart_PPK.bat`
- `google_apps_script.js` (canonical GAS source synced to `app/data/gas_template.js` via `tools/sync_apps_script_template.py`)
- `test_e2e_suite.js`
- `.gitignore`, `.gitattributes`

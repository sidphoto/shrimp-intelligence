# SharBo Globo Copilot Instructions

Read and follow `/AGENTS.md` before making repository changes.

## Project identity
- Product: **SharBo Globo｜蝦報全球**
- Static site: GitHub Pages
- Daily cutoff: `06:00 Asia/Taipei`
- Scheduled generation: `06:15 Asia/Taipei`

## Rules
- Treat look-ahead contamination as a blocking defect.
- Timezone-naive timestamps used for cutoff decisions must fail closed.
- Never weaken validators to make fixtures pass.
- Keep secrets out of source control.
- Do not redesign `index.html`, `app.js`, or `styles.css` unless explicitly asked.
- Preserve last-known-good `data/latest.json` on generation failure.

## Validation
For generator, data-contract, workflow, or publishing changes run:
```bash
python -m unittest discover -s tests -v
python scripts/validate_report.py data/latest.json
```
Do not claim completion if either fails.

Use repository agents by role: `collector`, `intelligence`, `sentinel`, `publisher`.
Preferred handoff: `Collector → Intelligence → Sentinel → Publisher`.

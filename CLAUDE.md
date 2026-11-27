# GOLDNET installation form (owaismai.github.io/goldnet-install): rules for Claude

The technicians' installation form: a static React + TypeScript + Vite + Tailwind PWA on GitHub Pages (public repo, no
backend). SUBMIT opens WhatsApp (click-to-chat to the install bot's number) with the form as labelled text; the technician
presses Send and shares the photos. The team bot in claude1 reads that text (`team_bot/install.py`, `itemhistory.py`,
`install_backfill.py`) and sets the customer up in Splynx.

## Starting a session
1. This file, then `README.md` (commands, configuration, the scanner, the Google key).
2. Map: form state and lists `src/types.ts` (technicians, plans), checks `src/utils/validation.ts`, the message
   `src/utils/whatsapp.ts`, serials `src/utils/serial.ts`, phone numbers `src/utils/phone.ts`, Radio app pre-fill
   `src/utils/prefill.ts`, PWA updates `src/utils/swUpdate.ts`; screens `src/sections/`, `src/components/`; tests `tests/`.
3. Tests before every push: `npm test` and `npm run build` (typecheck + build).
4. **Keep the message labels** (`Serial Number:`, `Wi-Fi Name:`, the `CPE` / `Router` blocks ...): the bot parses them. A
   label change needs the matching change in claude1's `team_bot/` in the same piece of work.
5. **CPE serials are 8-20 letters/digits** (the bot's `SERIAL_RE`): `serialProblem()` in `serial.ts` enforces it. Change both
   together.

## Deploying
- Every push to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`: `npm test`, build, upload, deploy). Check the
  workflow run after a push. Installed phones pick up the new version within an hour or when the app comes to the front.
- Work on your session branch; merge into `main` when done and tested (no share job merges it for you).
- Stranded branches: `claude/merge-stranded` (= `claude/panel-submit`, the 25 Oct ISP Manager submit, + `claude/review-2026-10-18`,
  never merged; the review's serial check and PWA update check were ported to main on 27 Nov 2026, its SA phone check is
  covered by main's `phone.ts`). Tell the owner what is there; don't merge or
  delete them on your own.

## Company rules (from owaismai/claude1, which stays the master copy)
- **We are GOLDNET.** Never write ZTEL in anything new (text, file names, drawings, commit messages). Suppliers only ever
  hear GOLDNET.
- **No interest, ever:** never put interest, late-payment charges or finance charges in any terms, quotes or documents.
- **Vrentals and GOLDNET are two worlds:** don't bring Vrentals material into GOLDNET work or the other way round.
- Give times to the owner in South African time (SAST, UTC+2); commit messages stay in UTC.
- Stay inside free usage (Google APIs, WhatsApp/Meta) and log findings in claude1's `reports/findings.csv` through the
  team bot, not by attaching claude1 to a session here.

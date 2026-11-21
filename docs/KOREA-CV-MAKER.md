# Korea CV Maker · specification and privacy contract

Source: `src/content/articles/giai-ma-ho-so-samsung-heavy-industries-resume-han-quoc.md` and historical six-page Korean application PDF provided by the project owner.

## Route, rollout, ownership
- Public code route: `/tools/korea-cv/`, using Astro SSG and existing `withBase`. The route MUST NOT expose CV content in HTML at build time.
- Two tabs: **Data Input** and **Saved CV & Export**. Second tab reads the *persisted* (not unsaved) record.
- Gate activation until authenticated Drive synchronization and verified PDF/XLSX exports work. No misleading "Saved" indicator.
- Each subfeature must ship in its own **Draft PR**, pass CI, and merge by FIFO only after owner approval. Do not re-enable or reuse removed Resume Studio.
- Google Drive is canonical. Cloudflare Worker is only a private authenticated synchronization/API layer. **GitHub holds source code, schema and blank fixtures only.**
- No credential, personal CV record, PDF output, spreadsheet export, or user content in logs, Actions artifacts, Git issues or repository history.

## Page mapping and template fidelity
1. **인적사항 / 학력 / 경력 / 자격 / 어학** (personal, education, work history, certifications, languages) with compact navy left-edge table headers and gridlines like page 1. Editable rows and date ranges.
2. **자기소개서** with five empty fields: 성장과정, 성격, 학교생활/사회생활, 지원동기/이직사유, 입사 후 포부.
3. **경력 사항 기술**: ordered project blocks with dates, project name, employer, role, responsibilities and evidenced outcomes. Repeat blocks across A4 pages as necessary; preserve readable borders and prevent clipped rows.
4. **Others**: skills, awards, training, languages, patents and optional referees (only with their permission), plus signature/date.
5. **석·박사과정 중 연구(논문)경력** optional research and thesis list; omit when not applicable, unless exact six-page blank-form mode selected.
6. Historical Samsung personal-data consent text is **not** a generic legal template and must **not** be reproduced as a current consent for an unrelated employer. Provide a neutral optional application-declarations sheet only when explicitly enabled.

Remove all Samsung wordmarks and branding, real/sample names, contact information, employment facts, project names, salary, TOEIC/OPIc values and referees from initial data. No invented achievements. Employer and target company blank; `ABC` may be used only as clearly marked placeholder. Do not claim this is the current Samsung form.

## Canonical storage model
- `schemaVersion: 1`, `id` (random UUID), `ownerSub` (Google verified subject), `label`, `targetCompany`, `targetRole`, `locale` (ko default), `createdAt`, `updatedAt`, `revision` and `content`.
- `content`: `personal`, `education[]`, `employment[]`, `certifications[]`, `languages[]`, `militaryOptional`, `essays` (five strings), `projects[]`, `skills[]`, `awards[]`, `training[]`, `patents[]`, `referees[]`, `research[]`, `declarationOptional`.
- All personal fields default empty; arrays default empty. Each repeating entry has a stable `id`; dates are explicit YYYY-MM or YYYY-MM-DD as appropriate.
- Create, list, get, update (with optimistic `revision` conflict rejection), duplicate, soft-delete, restore. Retain only needed revision snapshots in Drive; user may permanently delete their records.
- Separate `masterProfile` from per-application overrides, so edits for one employer do not alter other applications unexpectedly.
- External JSON files may be imported only after structural validation and explicit consent; never turn arbitrary user text into HTML.

## Google Drive, authorization, Cloudflare
- Use Google Identity Services and least privilege (`drive.appdata` for hidden app data, or `drive.file` for a user-visible, app-created folder). Do NOT request entire `drive` scope. Chosen mode must be consistent for all reads/writes.
- Cloudflare Worker must verify Google identity and authorization on **every** read/write (not trust user-supplied email, ownerSub, CV id or client-side claims). Per-owner isolation, strict CORS allowlist (GitHub Pages origin), anti-CSRF on cookie sessions, no public GET by predictable ID.
- Do not persist OAuth access/refresh tokens in localStorage, GitHub, KV cache or logs. Session security must be documented and tested.
- Drive canonical write must succeed *before* signaling saved or updating the Cloudflare-derived read view. Use authenticated read-through (no public caching of private documents); `Cache-Control: private, no-store`.
- If Cloudflare cache/index is ever needed, store only minimal opaque metadata with secure owner-level access. No plaintext CV content in KV, deployment bundles, CDN cache or public R2 buckets.
- Loading, empty, dirty, saving, saved, unauthorized, offline, failure and conflict states are required. Failure must preserve unsaved inputs in memory with a retry path; no silent loss.
- No analytics or third-party telemetry on private CV content. Escape text and avoid injecting entered values into network logs.

## Export and QA acceptance
- PDF: real A4 (210×297 mm), faithful Korean table grid styling, font supporting Hangul/Vietnamese, stable page breaks, no clipped rows, no printed app navigation, no absent content forcibly invented.
- Excel: real `.xlsx` with six logically equivalent worksheets and printable A4 areas; no CSV renamed XLSX; workbooks readable in Excel/LibreOffice, correct unicode, line wrapping, margins.
- Exports derive from latest confirmed Drive revision and are produced locally or by authenticated Worker with no GitHub intermediary.
- Test 320/375/768/1440 viewport, keyboard tabs, no horizontal overflow; session expiration, unauthorized access, save/reload, edit/duplicate/delete, concurrent edits, offline failure, Hangul+Vietnamese printing and spreadsheet load.
- Production verification: PR exact SHA CI checks, controlled FIFO merge, deployment release.json SHA, authenticated live Drive roundtrip and two downloaded exports.
- Missing credentials must result in clear, secure 'Google connection not configured' state, never a mock success.

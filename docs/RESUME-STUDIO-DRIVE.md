# Resume Studio — Google Drive storage contract

## Scope and verified folder

- Folder: [TechBlogTip Resume Studio](https://drive.google.com/drive/folders/1y0QzF2onlUrVdaQv8I-pu3L8T2d0CE19)
- Folder ID: `1y0QzF2onlUrVdaQv8I-pu3L8T2d0CE19`
- Created by the authorized Google Drive connector on 2026-11-21.
- Connector metadata says the folder is not shared, and owned by the connected account. **Do not publicly share it.**
- State: `resume-studio-state.json`, one JSON file in the folder. No Sheets file required.
- Resume text is private data: never commit to GitHub, static Astro output, or public build artifacts.

## OAuth and deployment gate

The browser connects directly to Google Drive using Google Identity Services OAuth token flow. The token exists only in tab memory, not `localStorage`, cookies, GitHub, or the generated static page source.

**Not production-ready until configured and live-tested:**

1. Register a Google OAuth Web application whose authorized JavaScript origin includes `https://duykhang68.github.io` and the actual staging origin used for testing.
2. Configure Google Cloud consent screen, Drive API and user/test-user access. Because this integration accesses a pre-created Drive folder, current prototype requests the broad `https://www.googleapis.com/auth/drive` scope. This is sensitive and **must be security-reviewed**. Prefer transitioning to `drive.file` with an app-created folder or Google Picker selection for least privilege before public launch.
3. Set `PUBLIC_RESUME_GOOGLE_CLIENT_ID` as an explicit build-time environment variable for Astro. The client ID is public; never embed client secrets.
4. Keep PR as Draft until exact-head-sha CI, browser login, first creation, reopen in a fresh tab, update, conflict behavior and private Drive file access are verified.
5. Never deploy browser app with a shared Google access token or developer token.

## Semantics and caveats

- GET Drive files by parent folder and exact name; refuse to overwrite if multiple files with the name exist.
- Save JSON via Drive files.create multipart or files.update media upload. A preliminary Drive version read helps detect stale changes, but it is **not transactional compare-and-swap**. Do not edit from two devices simultaneously.
- Autosave uses a debounce after typing; Google Drive requests consume Drive API quota.
- If a save fails, editor shows a visible error. Export backup JSON, reconnect and recover manually if needed.
- JSON backup is sensitive; store privately.
- Google OAuth consent is a user action; the ChatGPT Google Drive connector cannot silently authenticate a third-party website for a user.
- A separate `workers/resume` D1 prototype was intentionally removed when Drive was chosen. Publisher and its Sheets/Worker sessions must remain isolated.

## Acceptance checklist

- [x] Google Drive private folder created and read back through connector.
- [x] LocalStorage API removed from CV storage implementation.
- [x] Browser Drive OAuth and REST fetch/upload code written.
- [ ] Google OAuth client ID configured in build settings.
- [ ] Google Drive API OAuth consent and required scope approved.
- [ ] Login and real read/write tested on production-like browser origin.
- [ ] New CV, reopen tab, duplicate, delete, JSON backup/restore tested end-to-end.
- [ ] Mobile/Desktop, accessibility and exact-SHA staging release verified.

Until checked, do not claim fully working Drive persistence or production deployment.

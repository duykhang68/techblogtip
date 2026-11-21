# P8 Drive Picker → Cloudflare Images → Media Library → Editor

## Scope
- Authenticated same-origin Publisher endpoints: `GET /api/drive/files` lists image files from the pinned folder, `POST /api/media/import` imports 1–8 selected image IDs, `GET /api/media-library?sourceId=...` lists source-owned WebP, and `GET /api/media/:sourceId/:file.webp` serves authenticated preview bytes.
- Images are downloaded by a server-only Drive read-only Google service-account token, converted by a Cloudflare Images binding and verified as RIFF/WEBP. The service account **must have Viewer access** to the private acceptance folder.
- Content-addressed WebP is persisted in a per-source GitHub `media/tbt-...` branch for editorial review. Duplicate WebP bytes reuse the same path; paths are scoped to a system-issued source ID.
- WYSIWYG Editor inserts Markdown `![alt](/techblogtip/media/tbt-.../<sha>.webp)` and serializes/restores safe images. Saving to the Sheet preserves the image reference. When a READY article is sent for review, the Publisher verifies every local referenced asset and copies the WebP to the same **Draft PR branch**, never directly to main.
- No client-side GitHub API, Google credentials, unattended merge, scheduled polling, or changes to the production blog delivery.

## Deployment prerequisites
1. Cloudflare Publisher DEV must have Images optimization entitlement and `IMAGES` binding (configured in `cloudflare.config.ts`).
2. Share the **TBT-P8-Acceptance folder** (`1fcSwrezXFPJXr69bH135xa2bilZcZ2ID`) with the Publisher Google service-account email as Viewer. The existing Sheets service account is used with a separate `drive.readonly` token; no user-facing OAuth prompt.
3. After PR review/merge following FIFO, dispatch `deploy-publisher-dev.yml` on **main** with `confirm=deploy-dev-only`. Verify `/health` returns deployed exact main SHA.
4. Sign into `/editor` with an existing editable DRAFT source ID. Select JPG + PNG + WebP, import, insert an image, save, reopen and confirm the image persists.
5. Confirm duplicate imports do not create new media files. For a READY article submit an ordinary Draft PR and confirm the exact WebP asset paths are in its changed files. Never auto-merge a test article.

## Limitations
- Imports up to eight 10MB source files per request. Converted assets over 950KB are rejected, not silently resized further.
- Source-specific library is stored on a public repository branch. **Do not import sensitive/private imagery**. The UI loads the images through the authenticated Worker, but GitHub branch blobs are reviewable in the public repository.
- GitHub retains source-asset review branches; cleanup is manual after the PR has been released.
- CI mocks cannot prove live Drive folder permission, Cloudflare Images entitlement or a verified DEV deployment. Mark E2E PASS only after live evidence.

# TechBlogTip Editor 2.0 — tiến hóa, không thay Publisher

## Mục tiêu

Ba cách bắt đầu một bài (gõ trực tiếp, Notion P6, Obsidian P7) cùng đổ vào một WYSIWYG Editor. Một đường phát hành duy nhất: **Google Sheets VN → READY có xác nhận → Draft PR → CI/FIFO → merge → GitHub Pages → xác minh M:O**.

Editor 2.0 không cài Ghost, không dùng một CMS thứ hai và không lưu nội dung trong localStorage. Các module hiện có `editor-ui.mjs`, `ui.mjs`, Google OAuth session, Media Library, Notion/Obsidian adapters, khóa nguồn, visual preview, draft revision, GitHub publisher đều được tái sử dụng.

## Triển khai

- `studio-v2.mjs`: progressive enhancement, giao diện viết tập trung, tiêu đề nổi bật, metadata đóng mặc định, menu nhập Notion/Obsidian/Drive, slash insert menu, preview desktop/mobile, autosave vào Sheets và nút gửi xuất bản.
- `editor-studio-api.mjs`: tạo row DRAFT trống sau khi đăng nhập; khóa vị trí row; xác nhận hash; cập nhật **chỉ cột I (READY)** sau khi chủ bài nhấn xác nhận; kiểm tra snapshot, nội dung hợp lệ và đối chiếu lại row. Không ghi thay K:O hoặc tự merge PR.
- Các endpoint mới `POST /api/articles` (body `{}`) và `POST /api/approve` (`{sourceId,expectedSnapshot}`). Chúng đi qua `requireSameOrigin`, Google editor session và source/row locks có sẵn.
- Nút **Gửi xuất bản**: chờ xác nhận autosave → tải bản mới nhất → explicit approval → gọi `/api/submit` hiện hữu, tạo **Draft PR**. Nếu nội dung thiếu/khóa/xung đột, dừng an toàn và không đánh dấu PASS.
- Phần UI nâng cấp là additive: có thể ngắt bằng cách bỏ `STUDIO_*` khỏi route responses; backend Publisher cũ không bị thay thế.

## Hạn chế được bảo vệ

- Các bài chứa Markdown phức tạp vẫn được Editor cũ giữ nguyên và chuyển sang xem trước/chế độ không ghi đè để tránh mất bảng, code, wikilink hoặc asset. Điều này **chưa phải block editor lossless hoàn chỉnh**.
- Không gửi PR tự động chỉ vì autosave. READY yêu cầu người dùng xác nhận; review và merge FIFO do pipeline hiện tại đảm trách.
- Không tự tạo/chỉnh sửa Notion integration token, Google service-account JSON hoặc folder Drive. Không gọi dịch vụ trả phí. Cloudflare Images binding và quota hiện tại giữ nguyên.
- Tạo bài mới cần Google Sheets có row trống từ 2–200; nếu hết chỗ sẽ báo lỗi thay vì thay thế bài cũ.
- Autosave debounce; trên xung đột/không có quyền, dừng và yêu cầu tải lại, không ghi local cache có thể làm sai lệch dữ liệu.

## Checklist nghiệm thu thực tế

1. Login Publisher DEV và kiểm tra phiên vẫn tồn tại sau reload.
2. Nhấn **Bài viết mới**: xác minh A:O của một dòng trống mới, trạng thái DRAFT; không thay đổi row đã xuất bản.
3. Nhập tiêu đề và nội dung, chờ "Đã lưu vào Google Sheets"; reload Editor kiểm tra chính xác dữ liệu.
4. Test ảnh WebP từ local và Drive, Notion/Obsidian bản đơn giản; test source phức tạp bắt buộc review, không mất bài gốc.
5. Nhấn **Gửi xuất bản** trên bài có metadata hợp lệ và xác nhận; I chuyển READY, K:L chỉ được ghi sau tạo Draft PR có sourceRevision hợp lệ.
6. Kiểm tra Quality/Gitleaks/Publisher Worker đúng **head SHA** của PR code; không bypass FIFO.
7. Sau merge và chủ dự án phê duyệt, deploy Publisher DEV thủ công từ `main`, xác minh `/health` exact SHA và thực hiện live acceptance không dùng bài nháp giả.
8. Khi chủ dự án duyệt xuất bản bài thật: merge PR, xác minh public `release.json`, canonical 200 và biên nhận Sheets M:O.

## Một lần cấu hình thủ công của owner, nếu thiếu

1. Google OAuth Publisher: dùng **cấu hình đã tồn tại**, không tạo client mới. Bảo đảm Google session và service account Google Sheets hoạt động.
2. Nếu nhập Notion: thêm `NOTION_INTEGRATION_TOKEN` vào **Cloudflare Publisher DEV secret** và Share đúng trang Notion được phép với integration. Không điền vào GitHub public variables hoặc repo.
3. Nếu nhập ảnh Drive: tiếp tục dùng quyền Viewer của service account đối với thư mục P8 và binding Images như trong `docs/P8-MEDIA-ACCEPTANCE.md`.
4. Sau khi FIFO/CI và PR merged, chạy GitHub Actions `deploy-publisher-dev.yml` từ `main`, tham số `confirm=deploy-dev-only`. Đối chiếu `/health` trả đúng SHA main đã deploy.
5. Không cần nhập Ghost key, không mua Ghost(Pro), Obsidian Sync/Publish hoặc CMS trả phí.

## Rollback

Chỉ cần revert PR này. Các endpoint Publisher, bảng Sheets, article source ID, Media Library và release-writeback cũ không bị migrate hoặc xóa.

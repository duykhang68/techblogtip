# TechBlogTip — Giai đoạn 3: thiết lập một lần và nghiệm thu thật

> **Không đưa token, Client Secret, JSON key, CV hoặc nội dung riêng tư vào repo, Issues hay cửa sổ ChatGPT.** Chỉ cấu hình trong giao diện quản lý secret của GitHub/Cloudflare. Tài liệu này dành riêng cho TechBlogTip; tính năng Resume Studio cũ đã bị gỡ, không khôi phục.

## 0. Những gì đã có sẵn trong code (không cần cấu hình để CI chạy)

- **P6 Notion:** authenticated `GET /api/import/notion/pages` liệt kê tối đa 50 trang được chia sẻ (chỉ ID và tiêu đề); `POST /api/import/notion` trả preview, không ghi Sheets. Có kiểm tra ID, giới hạn 500 block, phân trang không lặp, giới hạn định dạng an toàn. Block lồng nhau, H1, numbered list, code, quote, rich formatting hoặc media yêu cầu review. Nếu thiếu token, API trả lỗi rõ ràng thay vì báo thành công.
- **P7 Obsidian:** authenticated `POST /api/import/obsidian` nhận một tệp .md ≤150 KB trong mỗi lần import (UI cho phép chọn tối đa 50 tệp và chọn một tệp để đưa vào DRAFT), kiểm tra path traversal, frontmatter, wikilink, embed, Markdown phức tạp. Các trường hợp dễ mất dữ liệu yêu cầu review.
- **Editor:** chỉ cho nhập vào DRAFT đang mở; không ghi Sheet khi preview; có xác nhận trước khi thay nội dung bản nháp. Người dùng bấm **Lưu vào Sheets** riêng. READY/PUBLISHED, K:O và quy tắc Draft PR/FIFO không bị thay đổi.
- **SEO:** deploy production chạy exact SHA, kiểm tra sitemap/robots/canonical và số trang mẫu; GSC URL Inspection chỉ đọc, báo SKIP khi thiếu cấu hình. Không submit URL hàng loạt và không cron.
- **QA:** Quality, Gitleaks, Publisher tests, visual QA và source-import regression tests chạy trên PR head SHA.

## 1. Cấu hình Notion P6 — *chỉ làm khi sẵn sàng nghiệm thu*

1. Trong Notion, tạo **internal integration** riêng cho TechBlogTip, chỉ cấp quyền **Read content** cần thiết. Lấy **Internal Integration Secret**. Không gửi secret cho ChatGPT.
2. Tại Notion page muốn nhập thử (dùng trang không chứa dữ liệu nhạy cảm), mở **Connections** và thêm integration đó. Chỉ trang đã được chia sẻ mới đọc được.
3. Mở [GitHub repository → Settings → Environments](https://github.com/duykhang68/techblogtip/settings/environments) → `techblogtip-publisher-dev` → **Environment secrets** → New environment secret. Đặt:
   - **Name:** `TBT_NOTION_INTEGRATION_TOKEN`
   - **Value:** Internal Integration Secret ở bước 1.
4. Không cần sửa code hoặc `workers/publisher/.env.example`. Workflow `.github/workflows/deploy-publisher-dev.yml` chuyển secret được bảo vệ sang binding `NOTION_INTEGRATION_TOKEN` khi deploy. Nếu không cấu hình, deploy vẫn PASS cho Publisher/P7 nhưng Notion P6 báo `notion_token_missing`.
5. Sau khi PR chứa tích hợp này merge và Quality/Security PASS, vào [Actions → Deploy Publisher DEV](https://github.com/duykhang68/techblogtip/actions/workflows/deploy-publisher-dev.yml) → **Run workflow** → branch `main`, confirm `deploy-dev-only`. Chỉ deploy theo quy trình chính thức. Mở [Publisher DEV /health](https://techblogtip-publisher-dev.tamsudev-com.workers.dev/health) và đối chiếu `releaseSha` với commit `main` đã deploy. **Không cần xóa các secret đã được cấu hình trước đây.**
6. Trong [Publisher DEV Editor](https://techblogtip-publisher-dev.tamsudev-com.workers.dev/admin/), đăng nhập bằng tài khoản editor được phép. Mở một bản **DRAFT có quyền chỉnh sửa**, bấm **Duyệt trang Notion** để chọn một trang đã được chia sẻ (tối đa 50 kết quả), hoặc dán Notion Page ID (32 ký tự hex, có thể có dấu gạch ngang), rồi bấm **Nhập Notion**. Dropdown chỉ trả tiêu đề và Page ID, không trả token.
7. Với trang nội dung đơn giản và được hỗ trợ: kiểm tra WYSIWYG → bấm **Lưu vào Sheets** → tải lại cùng DRAFT để đối chiếu title/body/source ID. Với trang có block/định dạng chưa hỗ trợ: hệ thống phải báo **Review required** và **không thay thế bản nháp**.
8. Chỉ sau khi chủ dự án chấp nhận nội dung mới cho phép chuyển READY → Draft PR → Quality/Security/FIFO → merge → production → M:O. **Không publish tự động chỉ vì đã import thành công.**

## 2. Nghiệm thu Obsidian P7 — không cần token Notion

1. Chuẩn bị **một tệp .md không nhạy cảm**; tránh đưa toàn bộ vault/private assets lên môi trường thử. Có thể kiểm thử lần đầu với:
   ```markdown
   ---
   title: Ví dụ TechBlogTip
   ---
   ## Mở đầu

   Một đoạn văn tiếng Việt.

   - Ý thứ nhất
   - Ý thứ hai
   ```
2. Trong Editor DRAFT của Publisher DEV, chọn tối đa 50 tệp ở **Obsidian Markdown**, chọn **một** ghi chú trong dropdown rồi bấm **Nhập ghi chú**. Chỉ tệp được chọn được gửi đến API; các tệp khác không bị upload hay ghi Sheets. Lặp lại thủ công với từng bản DRAFT nếu cần. Nội dung chỉ được đưa vào WYSIWYG sau bước xác nhận; kiểm tra title, dấu tiếng Việt, đoạn văn và danh sách.
3. Bấm **Lưu vào Sheets**, tải lại và so nội dung. Sau đó kiểm tra một tệp phức tạp chứa `[[wikilink]]`, `![[media]]`, H1, Markdown link, table hoặc code fence: phải **chặn nhập tự động và yêu cầu review**. Không được làm mất nội dung cũ hoặc tự đưa media private lên URL công khai.
4. Chỉ khi được duyệt mới thực hiện READY → Draft PR → exact-head CI. Việc tự động tạo nhiều bản DRAFT từ toàn bộ vault và ánh xạ attachment đầy đủ **chưa được xem là hoàn chỉnh** chỉ vì single-file preview đã PASS.

## 3. Google Search Console Indexing — cấu hình một lần

1. Xác minh đúng property `https://duykhang68.github.io/techblogtip/` trong Google Search Console.
2. Trong Google Cloud, bật **Google Search Console API**. Tạo **service account chuyên biệt**, cấp quyền tối thiểu; nếu Google yêu cầu khóa JSON, tạo key mới để dùng với workflow.
3. Trong Search Console → **Settings → Users and permissions**, thêm email của service account vào đúng property đã xác minh. Chỉ cấp quyền cần thiết để đọc dữ liệu.
4. Trong [GitHub → Settings → Secrets and variables → Actions](https://github.com/duykhang68/techblogtip/settings/secrets/actions), đặt repository secret `GSC_SERVICE_ACCOUNT_JSON` chứa *toàn bộ* JSON key. Sử dụng **repository secret** để cả deploy production và manual `seo-index-monitor.yml` (workflow không khai báo environment riêng) có thể đọc. Không commit JSON. Nếu `GSC_SITE_URL` khác URL mặc định, thêm Repository variable `GSC_SITE_URL` với đúng property URL.
5. Sau khi deploy production exact SHA PASS, vào [Actions → SEO · Google indexing monitor](https://github.com/duykhang68/techblogtip/actions/workflows/seo-index-monitor.yml) → **Run workflow**. Đọc job summary: `PASS`, `NOT_INDEXED` hoặc `UNKNOWN` theo URL sample. Không suy đoán Google index chỉ từ HTTP 200; không submit lại toàn bộ URL hằng ngày.
6. Kết quả Google có thể xuất hiện trễ hơn phát hành. Google không bảo đảm lập chỉ mục mọi URL.

## 4. Những secret *không cần bổ sung nếu Publisher đang hoạt động*

Giữ nguyên `CLOUDFLARE_API_TOKEN`, `TBT_GOOGLE_OAUTH_CLIENT_ID`, `TBT_ALLOWED_EDITORS`, `TBT_SHEETS_SPREADSHEET_ID`, `TBT_SHEETS_GID`, `TBT_GOOGLE_SERVICE_ACCOUNT_JSON`, `TBT_GITHUB_PUBLISHER_TOKEN`, `TBT_PRODUCTION_SYNC_TOKEN`. Không thay đổi secret hoặc cấp quyền rộng hơn chỉ vì nghiệm thu P6/P7.

## 5. Cổng đóng Giai đoạn 3

- [ ] Code P6/P7 merged theo FIFO; đúng head SHA, Quality/Security/Gitleaks PASS.
- [ ] Publisher DEV `/health.releaseSha` khớp bản vừa triển khai; authenticated API hoạt động, anonymous requests bị từ chối.
- [ ] P6 token có quyền đọc trang thử; live preview không mất nội dung; lưu DRAFT + mở lại + Draft PR thực sự.
- [ ] P7 một tệp .md thật lưu DRAFT + mở lại + Draft PR; tệp nhiều Markdown/asset buộc review.
- [ ] Search Console URL Inspection chạy bằng quyền đọc và báo trạng thái có nguồn; nếu vẫn SKIP thì ghi blocker, không đánh dấu PASS.
- [ ] Mobile/desktop QA và sitemap/robots/canonical PASS trên release SHA mới.
- [ ] Không khôi phục Resume Studio hoặc trộn Korea CV Maker vào phạm vi này.

Các điều kiện phụ thuộc token/tài khoản/thao tác của chủ dự án **không thể tự chuyển sang PASS bằng unit tests hoặc PR merge**.

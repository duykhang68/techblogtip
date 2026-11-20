# TechBlogTip

> Kho thủ thuật và kiến thức công nghệ tiếng Việt · Astro static-first · Cloudflare Workers Static Assets.

**Repository mới, độc lập:** [duykhang68/techblogtip](https://github.com/duykhang68/techblogtip). Milestone A đã đạt staging acceptance; Milestone B Publisher DEV đang tiếp tục hoàn thiện. **Chưa phải public SEO launch.**

## Bắt đầu

Yêu cầu Node.js >=22.22.0 (khuyến nghị 24).

```bash
npm install
npm run dev
npm run quality
```

Giao diện ban đầu bao gồm trang chủ, danh mục, thẻ, series, bài viết, tìm kiếm tĩnh, RSS, sitemap và trang 404. Các bài demo dùng để xác thực giao diện; **không phải nội dung editorial đã phê duyệt cho SEO launch**.

## Luồng phát hành

1. Thay đổi code/content trên branch, mở **Draft PR**.
2. CI chạy Astro check, content validator, test, build và output verification.
3. Khi đủ điều kiện, người quản trị duyệt PR và merge theo thứ tự FIFO.
4. Push `main` kích hoạt deploy **staging** bằng Cloudflare CLI `cf`; yêu cầu repository secrets `CLOUDFLARE_API_TOKEN` và `CLOUDFLARE_ACCOUNT_ID`.
5. Job truy cập public `/release.json`, so khớp SHA chính xác với `GITHUB_SHA`. Fail nếu trang chưa có bản đã deploy.

**Staging:** https://techblogtip-staging.tamsudev-com.workers.dev/ (đã có exact-SHA deployment verification). Mặc định `noindex,nofollow` và `robots.txt` chặn crawl; staging **không phải biện pháp bảo mật** — bật Cloudflare Access nếu có dữ liệu riêng tư.

Site URL được xác định tại build bằng `SITE_URL`; chỉ bật `PUBLIC_INDEXABLE=true` khi domain công khai đã chốt và đã kiểm tra SEO.

## Nguyên tắc dự án

- GitHub là nguồn chính thức của nội dung xuất bản.
- Google Sheets Publisher DEV đã kết nối thật với Sheet VN và GitHub read-only; ghi Draft PR thực tế chưa nghiệm thu. Notion, Obsidian và Drive media là các pha sau.
- Không thêm Client-side GitHub API.
- Không cần Obsidian Publish hay Notion Sites để host blog.
- Không tái sử dụng secret và tích hợp của OneBlog.

Xem `docs/ROADMAP.md`, `docs/OPERATIONS.md` và `AGENTS.md`.

## Google Sheets Publisher DEV

- [Publisher Admin](https://techblogtip-publisher-dev.tamsudev-com.workers.dev/admin) dùng Google allowlist, phiên cookie 7 ngày, Sheet VN và Draft-first.
- Sau PR thay đổi Worker, chỉ deploy thông qua [manual Publisher DEV workflow](https://github.com/duykhang68/techblogtip/actions/workflows/deploy-publisher-dev.yml) trên main; CI staging không deploy Worker này.
- [Issue #19](https://github.com/duykhang68/techblogtip/issues/19) chờ nghiệm thu thật READY→Draft PR→K:L. CI xanh và merge không phải bằng chứng production.
- Milestone P5c: bổ sung tra cứu PR/CI thủ công trên đúng SHA, rồi WYSIWYG, Drive→WebP và writeback M:O khi public production đã được xác minh.

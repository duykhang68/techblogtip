# TechBlogTip

Blog kiến thức công nghệ tiếng Việt sử dụng **Astro**, phát hành qua **GitHub Pages** và staging tại **Cloudflare**. Các bài viết công khai, Archive, Bản đồ tri thức, tìm kiếm, RSS, SEO và **Korea CV Maker** vẫn được giữ nguyên.

**Đã ngừng sử dụng:** Hệ thống viết/xuất bản bài bằng Google Sheets/Excel, Visual Editor/Studio 2.0, Notion và Obsidian đã được gỡ khỏi code theo yêu cầu. Không có API/giao diện Publisher hiện hành. Chỉ phát triển lại khi chủ dự án có yêu cầu mới.

## Cài đặt và kiểm tra

```bash
npm install
npm run quality
npm run dev
```

## Quy trình release

PR Open/Ready → kiểm tra Quality, bảo mật, FIFO → merge → GitHub Pages exact SHA. Cloudflare staging luôn `noindex`. Không còn Publisher DEV hoặc đồng bộ Google Sheets M:O.

- [Production](https://duykhang68.github.io/techblogtip/)
- [Roadmap](docs/ROADMAP.md)
- [Branding](docs/BRANDING.md)
- [Korea CV Maker](docs/KOREA-CV-MAKER.md)
- [Actions](https://github.com/duykhang68/techblogtip/actions)

Những bài đăng cũ về Sheets, Notion và Obsidian là **bài viết lịch sử**, không phải tính năng tích hợp đang hoạt động.

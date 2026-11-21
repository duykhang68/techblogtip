# TechBlogTip — roadmap và cổng nghiệm thu

Cập nhật 21/11/2026. Đây là bảng trạng thái triển khai hiện hành; các tài liệu
`docs/PUBLISHER-P5C3-RELEASE.md`, `docs/P8-MEDIA-ACCEPTANCE.md` và
`docs/SEO-SEARCH-CONSOLE-LAUNCH.md` là tài liệu giao thức/kiểm thử chi tiết.
**Luôn phân biệt code merged, DEV deployed, public production và nghiệm thu do chủ
dự án xác nhận.** Một PR merged không đồng nghĩa chức năng đã lên production.

## Ưu tiên theo rủi ro và giá trị

| Ưu tiên | Hạng mục | Trạng thái có bằng chứng | Việc còn lại / điều kiện đóng |
| --- | --- | --- | --- |
| P0 | FIFO, CI, bảo mật | PR #111 (TOC) merged `4f973e03`; PR #115 (ổn định bố cục/lazy image) Quality + Gitleaks PASS trên `cc6c63e5`, merged `ee70f571` | Xác minh public `release.json` khớp commit đã deploy; không merge trước CI/exact head SHA |
| P0 | Publisher DEV mới | C3 được merge qua PR #95; Worker công khai vẫn trả `73d4cf5e21ce17f9e111f37f2e1804baed90d80b` ở checkpoint này | Dispatch workflow `deploy-publisher-dev.yml` trên main, `confirm=deploy-dev-only`, xác minh /health exact SHA trước khi nói C3 đang chạy trên DEV |
| P0 | P8 Media Library | PR #79 merged `73d4cf5e`; DEV deployment #44907894608 PASS; chủ dự án xác nhận nghiệm thu PASS ngày 21/11/2026 | Ghi nhận nghiệm thu của chủ dự án; không tự tạo ảnh/media mới hoặc sửa bài READY đã gửi PR |
| P1 | P5b/P5c end-to-end | READY → Draft PR/K:L đã có bằng chứng ở PR #35; workflow production GitHub Pages + release M:O có code gate; chủ dự án xác nhận các nghiệm thu PASS | Khi phát hành bài mới phải kiểm tra riêng live URL HTTP 200, exact release SHA và M:O; không suy đoán từ trạng thái Sheet hoặc PR merged |
| P1 | Google Search Console/SEO | Google property đã được chủ dự án xác minh; sitemap #110 merged `8afcea8c`, public `release.json` khớp, 71 URL đọc được | Theo dõi tình trạng Google Sitemaps/Indexing qua Search Console; URL fetch được không đảm bảo Google đã index |
| P1 | C3 Operations | PR #95 merged, code snapshot Sheets + Actions chỉ đọc, bấm làm mới; token server-only | Deploy Publisher DEV mới, thử live on-demand snapshot (không polling/cron); không hiển thị là dữ liệu trực tiếp nếu API unavailable |
| P2 | P6 Notion | Đã có endpoint xác thực `POST /api/import/notion`, preview/read-only, giới hạn 500 blocks; phần không biểu diễn lossless bắt buộc Review | Kiểm tra Notion Integration token và chia sẻ page theo nguồn thực; chưa tuyên bố hỗ trợ mọi block/asset |
| P2 | P7 Obsidian | Đã có `POST /api/import/obsidian`, preview .md, kiểm tra path/traversal, frontmatter, attachment; Editor chỉ nhập nội dung có thể chỉnh sửa an toàn | Bài có Wikilink/media/Markdown nâng cao cần review hoặc nâng cấp trình chuyển đổi lossless trước khi ghi Sheets |
| P2 | C1/C2, Astro, branding | Bản đồ tri thức, Editorial Dashboard, Archive, SEO/robots/RSS và giao diện mobile đã phát hành ở các PR trước | Duy trì accessibility, Lighthouse, bẻ dòng tiếng Việt tự nhiên, data snapshot tĩnh |

## Bản nghiệm thu do chủ dự án xác nhận

Trong cuộc trao đổi ngày 21/11/2026, chủ dự án xác nhận **các nghiệm thu đã PASS**.
Ghi nhận đây là **owner acceptance**, không tự chuyển thành bằng chứng kỹ thuật
mới của từng lượt tải ảnh/Google OAuth/Google Indexing. Không yêu cầu người dùng
thử lại P8 khi không có regression cụ thể.

## Chính sách phát hành

1. **Draft-first + FIFO**: mọi thay đổi không thuộc ngoại lệ README/AGENTS phải qua
   PR; chỉ Ready và merge khi không có PR đứng trước đủ điều kiện, head SHA được kiểm
   và Quality/Security/required checks đều PASS. Không bypass branch rules.
2. **Exact SHA**: GitHub Pages chỉ là production khi public `release.json` khớp
   deploy release, không dựa vào merged status.
3. **Publisher DEV độc lập**: merge vào main không tự cập nhật Cloudflare Worker.
   Triển khai theo workflow manual + secret gate; `/health` phải báo SHA mới.
4. **Zero client GitHub API**: dữ liệu vận hành từ Worker có xác thực hoặc snapshot
   tĩnh; không cron hoặc polling không cần thiết.
5. **Fail closed**: thất bại Google Sheets/Notion/Drive/CI không được coi là PASS;
   source lock/Durable Object và bảo vệ READY/PUBLISHED không bị bỏ qua.
6. **No false completion**: ngày triển khai, ngày Google xử lý sitemap, mốc owner
   acceptance, CI SHA và M:O production proof là các dấu mốc độc lập.

## Tài liệu và trang tham chiếu

- [Publisher DEV](https://techblogtip-publisher-dev.tamsudev-com.workers.dev/admin/)
- [GitHub Pages](https://duykhang68.github.io/techblogtip/)
- [Sitemap](https://duykhang68.github.io/techblogtip/sitemap.xml)
- [GitHub Actions](https://github.com/duykhang68/techblogtip/actions)
- [Open PRs](https://github.com/duykhang68/techblogtip/pulls)
- [Production writeback](PUBLISHER-P5C3-RELEASE.md)
- [Drive Media Acceptance](P8-MEDIA-ACCEPTANCE.md)
- [Search Console Launch](SEO-SEARCH-CONSOLE-LAUNCH.md)

## Lịch sử triển khai cốt lõi

- A/P0–P4: Astro SSG, editorial responsive, taxonomy, search, RSS, SEO, CI,
  Cloudflare staging đã được nghiệm thu từ 20/11/2026.
- P5b: Google Sheets VN row 3, source ID
  `TBT-ed3fa834-d43c-4852-ad7b-1128cd4486c0`, PR #35 và Quality
  #44837806420 chứng minh READY → Draft PR → K:L; PR test đóng không merge.
- P8: PR #79, deploy #44907894608, DEV SHA `73d4cf5e`.
- C1/C2/C3: static Knowledge Map, Editorial Dashboard; C3 PR #95 merged.
- D: Search Console property + verification meta, XML sitemap PR #110; 71 URL
  xuất hiện trên GitHub Pages ở SHA `8afcea8c`.

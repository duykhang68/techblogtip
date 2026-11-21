# TechBlogTip — roadmap và cổng nghiệm thu

Cập nhật nghiệm thu 21/11/2026 (Giai đoạn 1 + bằng chứng Giai đoạn 2). Đây là bảng trạng thái triển khai; các tài liệu
`docs/PUBLISHER-P5C3-RELEASE.md`, `docs/P8-MEDIA-ACCEPTANCE.md` và
`docs/SEO-SEARCH-CONSOLE-LAUNCH.md` là tài liệu giao thức/kiểm thử chi tiết.
**Luôn phân biệt code merged, DEV deployed, public production và nghiệm thu do chủ
dự án xác nhận.** Một PR merged không đồng nghĩa chức năng đã lên production.

## Bàn giao Giai đoạn 1 — hoàn thành (21/11/2026)

- **GitHub Pages exact SHA PASS:** public `/techblogtip/release.json` khớp `0f464a973f2f11ae9a43cf776cd4eccc15cd10df`, production workflow #44913589718 success.
- **Publisher DEV exact SHA PASS:** workflow thủ công #44918362539 success; `/health` trả cùng SHA, Cloudflare active deployment đưa 100% traffic vào version tương ứng.
- **C3 live acceptance PASS — owner confirmed:** chủ dự án xác nhận trực tiếp ngày 21/11/2026; đây là xác nhận nghiệp vụ, không thay thế log kiểm thử độc lập.

## Giai đoạn 2 — nghiệm thu bài viết thật, không ghi đè nguồn

- **P8 Media Library:** chủ dự án đã xác nhận PASS; không yêu cầu nghiệm thu lại hay tạo media thử nếu không có regression.
- **P5 E2E source:** Google Sheets TechBlogTip tab `VN`, row 4, source ID `TBT-ab577196-3e16-42a6-9185-60fbc4cbb534`, status `READY`, K=`a8f4b6d019c16be853b021eb1be36ffa4b5d845df76702f68f578a27a816ab68`, L=[PR #54](https://github.com/duykhang68/techblogtip/pull/54) (merged).
- **Release proof:** [production #44857149957](https://github.com/duykhang68/techblogtip/actions/runs/44857149957) success; bài public tại `/techblogtip/bai-viet/hanh-trinh-xay-dung-google-sheets-publisher-techblogtip/` hiện truy cập được. M:O trong Sheet tương ứng là URL public, `2a755191875402684a65510238553833a00307a4`, `2026-11-21T02:41:26.222Z`. GitHub compare chứng minh commit M:O là ancestor của release hiện tại `0f464a973f2f11ae9a43cf776cd4eccc15cd10df`.
- **Không sửa status I để ép PUBLISHED:** M:O là biên nhận có xác minh; việc Sheet vẫn giữ READY không được dùng để suy diễn đã lỗi hay để âm thầm đổi nội dung do editor sở hữu.
- **Safety:** bài test PR #35 đóng không merge; không tạo PR viết bài giả, không thay đổi K:O để làm đẹp thống kê. Mỗi bài xuất bản mới phải chứng minh lại K:L, merge, exact SHA, URL public và M:O.

## Kế hoạch còn lại — không bao gồm Resume Studio (21/11/2026)

**Giai đoạn 1: DONE 100%.** Production SHA, Publisher DEV và C3 Owner Acceptance đã PASS.

**Giai đoạn 2: Publisher E2E DONE.** Bài thật Google Sheets VN!4 đã có Draft PR #54, CI/merge, production URL và biên nhận M:O. P8 Media đã được chủ dự án xác nhận PASS. Resume Studio đã nghỉ và gỡ khỏi TechBlogTip, không còn là điều kiện đóng giai đoạn.

- **Retired feature:** [PR #124](https://github.com/duykhang68/techblogtip/pull/124) xóa Astro route `/tools/resume/`, script QA, tài liệu và OAuth build gate. Public release `33c9c101c0e3bc524dbffcea0329057d879ed355` đã verified; URL cũ trả HTTP 404, sitemap không có route. Không xóa dữ liệu Google Drive người dùng hoặc bài nghiên cứu CV Samsung độc lập.
- **FIFO/CI:** PR #121 (SEO), #122 (typography), #124 (retire Resume Studio) đã merge. [Issue #123](https://github.com/duykhang68/techblogtip/issues/123) đóng sau khi loại trigger `workflow_run` nguy hiểm và Security Audit PASS.

**Giai đoạn 3: chưa nghiệm thu end-to-end**, tập trung:

- **P6/P7 + SEO one-time setup:** xem [PHASE3-ONE-TIME-SETUP.md](PHASE3-ONE-TIME-SETUP.md). Chỉ cấu hình token một lần sau khi code/CI sẵn sàng; không lưu secret trong repo và không khẳng định live PASS khi chưa có kiểm chứng.


1. [P6 Notion #125](https://github.com/duykhang68/techblogtip/issues/125): dữ liệu nguồn thật → preview lossless/review → WYSIWYG → DRAFT Google Sheets → Draft PR. Blocks/media chưa hỗ trợ phải Review, không ghi đè âm thầm.
2. [P7 Obsidian #126](https://github.com/duykhang68/techblogtip/issues/126): file Markdown thật → bảo toàn frontmatter/wikilinks/attachments hoặc Review bắt buộc → DRAFT Sheets → Draft PR. Không xuất bản tự động.
3. **SEO:** live sitemap 78 URL, 6 sampled HTML pages, robots/canonical PASS trong run #44920107716. Google URL Inspection **SKIP** vì `GSC_SERVICE_ACCOUNT_JSON` chưa được cấu hình; không được suy đoán là Google đã index. Monitor chỉ đọc, không submit URL hàng loạt và không cron.
4. **Mobile/performance:** tiếp tục kiểm thử hồi quy khi có thay đổi; không tái kiểm thử tính năng đã nghỉ.

**Quy tắc:** Giai đoạn 3 chỉ được đóng sau live acceptance bằng nguồn được cấp phép; code merge và Worker endpoint có sẵn không chứng minh nhập dữ liệu thật đã PASS.

## Ưu tiên theo rủi ro và giá trị

| Ưu tiên | Hạng mục | Trạng thái có bằng chứng | Việc còn lại / điều kiện đóng |
| --- | --- | --- | --- |
| P0 | FIFO, CI, bảo mật | PR #111 (TOC) merged `4f973e03`; PR #115 (ổn định bố cục/lazy image) Quality + Gitleaks PASS trên `cc6c63e5`, merged `ee70f571` | Xác minh public `release.json` khớp commit đã deploy; không merge trước CI/exact head SHA |
| P0 | Publisher DEV mới | **PASS**: workflow #44918362539 thành công; Cloudflare `/health` trả `0f464a973f2f11ae9a43cf776cd4eccc15cd10df` và nguồn deploy 100% traffic | Deploy mới chỉ cần khi main cập nhật có thay đổi Worker; không tái deploy vì tài liệu |
| P0 | P8 Media Library | PR #79 merged `73d4cf5e`; DEV deployment #44907894608 PASS; chủ dự án xác nhận nghiệm thu PASS ngày 21/11/2026 | Ghi nhận nghiệm thu của chủ dự án; không tự tạo ảnh/media mới hoặc sửa bài READY đã gửi PR |
| P1 | P5b/P5c end-to-end | **PASS cho bài thật `TBT-ab577196-...`**: Sheet `VN!4` K:L → PR #54 merged → prod run #44857149957 PASS → URL public đọc được → M:O đã có URL, SHA `2a755191875402684a65510238553833a00307a4`, UTC `2026-11-21T02:41:26.222Z`; SHA là ancestor của public release `0f464a97...` | Bài mới phải có bằng chứng riêng; không suy đoán trạng thái chỉ từ READY/PUBLISHED |
| P1 | Google Search Console/SEO | Google property đã được chủ dự án xác minh; sitemap #110 merged `8afcea8c`, public `release.json` khớp, 71 URL đọc được | Theo dõi tình trạng Google Sitemaps/Indexing qua Search Console; URL fetch được không đảm bảo Google đã index |
| P1 | C3 Operations | PR #95 merged; Worker DEV exact SHA verified; **chủ dự án xác nhận nghiệm thu live PASS ngày 21/11/2026** | Giữ phân biệt owner acceptance và test độc lập; duy trì refresh theo yêu cầu, không polling/cron |
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

---
title: "Từ Google Sheets đến production: hành trình xây dựng TechBlogTip Publisher"
description: "Hậu trường xây dựng Google Sheets Publisher: từ biên tập, Draft PR, CI exact SHA đến xác minh GitHub Pages và ghi ngược trạng thái xuất bản bằng bằng chứng."
published: "2026-11-21"
category: "Engineering"
author: "Duy Nguyen | Engineering team"
tags: ["Google Sheets","Astro","Cloudflare Workers","GitHub Actions","GitHub Pages","CI/CD","Publisher","Exact SHA"]
series: "Hậu trường TechBlogTip"
sourceType: "google-sheets"
sourceId: "TBT-ab577196-3e16-42a6-9185-60fbc4cbb534"
sourceRevision: "a8f4b6d019c16be853b021eb1be36ffa4b5d845df76702f68f578a27a816ab68"
draft: false
---

> Một bài viết không nên được gọi là “đã đăng” chỉ vì ai đó nhấn nút Deploy. Đây là câu chuyện TechBlogTip xây dựng đường đi từ một dòng Google Sheets đến một trang web công khai có thể kiểm chứng bằng commit SHA.

## 01. Bắt đầu từ một câu hỏi rất đời thường

Người viết blog thường muốn làm ba việc: nghĩ ý tưởng, viết cho tốt và bấm xuất bản. Thế nhưng giữa bản nháp và đường dẫn công khai lại là một loạt thao tác ít người muốn nhớ: đặt tên file, chỉnh frontmatter, tạo nhánh Git, mở Pull Request, kiểm tra build, chờ merge rồi đối chiếu website.

Với [TechBlogTip](https://duykhang68.github.io/techblogtip/), chúng tôi muốn phần phức tạp ấy biến mất khỏi bàn làm việc của người viết — nhưng **không biến mất khỏi hệ thống kiểm soát**.

Ý tưởng ban đầu khá ngây thơ: “Sao không viết bài ngay trong Google Sheets?”. Vài vòng triển khai sau, câu hỏi đã thay đổi thành: **Làm thế nào để một ô trạng thái có thể nói thật về cả chuỗi xuất bản?**

Đó là lúc Google Sheets Publisher không còn là một nút nhập dữ liệu; nó trở thành một hệ thống phát hành có bằng chứng.

## 02. Bức tranh tổng thể: sáu trạm, một đường về

Hãy hình dung bài viết như một kiện hàng có mã vận đơn. Google Sheets tiếp nhận bài; Cloudflare Worker điều phối; GitHub kiểm duyệt; GitHub Pages giao hàng; cuối cùng biên lai quay về đúng dòng Sheet ban đầu.

| Trạm | Nơi thực hiện | Bằng chứng cần giữ |
| --- | --- | --- |
| 01 · Soạn | Google Sheets / Editorial Studio | Mã nguồn bài viết ổn định |
| 02 · Duyệt | Trạng thái READY | Ý định xuất bản của biên tập viên |
| 03 · Đóng gói | GitHub Draft PR | URL PR và dấu vân tay nội dung |
| 04 · Kiểm định | CI / Quality | Kết quả trên exact head SHA |
| 05 · Giao hàng | Merge và GitHub Pages | Release SHA trên site public |
| 06 · Biên nhận | Google Sheets, cột M:O | URL bài, SHA và thời điểm xác minh |

**Không có đường tắt từ READY tới PUBLISHED.** Một bài chỉ được xem là hoàn tất khi vượt qua cả sáu trạm; merge PR cũng chưa đủ.

## 03. Google Sheets là bàn biên tập, không phải nút “publish bất chấp”

Tab VN của Publisher được chia rõ theo quyền sở hữu dữ liệu.

**Các trường của biên tập viên** gồm tiêu đề, nội dung, tác giả, chuyên mục, thẻ, tóm tắt, series, trạng thái và slug. Người viết có thể sửa bài mà không cần thuộc cú pháp frontmatter của Astro.

**Các trường của hệ thống** lại là chuyện khác:

| Cột | Trường | Vai trò |
| --- | --- | --- |
| A | source_id | Định danh bền vững của một bài |
| K | source_hash | Dấu vân tay SHA-256 của nội dung đã gửi |
| L | draft_pr | Liên kết đến PR thực tế |
| M | published_url | Đường dẫn bài được xác minh trên web |
| N | release_sha | Commit nằm trong bản phát hành |
| O | published_at | Mốc UTC khi xuất bản được xác minh |

Sự tách biệt này giải quyết một lỗi khó chịu: **đổi nội dung trong Sheet sau khi tạo PR**. Nếu văn bản đổi, dấu vân tay hiện tại sẽ khác bản đã được kiểm tra. Hệ thống không được phép lờ đi sự khác biệt ấy.

> Quy tắc thiết kế số một: nội dung có thể thay đổi, nhưng bằng chứng phải đi cùng đúng phiên bản nội dung đó.

## 04. Một cú nhấn tạo Draft PR kích hoạt những gì?

Đường đi của Publisher có chủ ý: biên tập viên duyệt READY, chủ động gửi bài; Worker mới đọc lại nguồn đã được cho phép và tạo nhánh riêng.

Quy trình gồm bốn hành động:

1. Đọc đúng dòng Sheet và xác minh mã nguồn, trạng thái, độ dài nội dung, slug và hình ảnh hợp lệ.
2. Chuẩn hóa Markdown rồi tính fingerprint SHA-256 từ dữ liệu tác giả và danh tính nguồn. Fingerprint không phụ thuộc số hàng hoặc cột trạng thái.
3. Tạo file bài viết trong Astro, mở **Draft Pull Request** — chưa tự merge, chưa tự phát hành.
4. Ghi fingerprint vào **K** và URL PR vào **L**, sau đó đọc lại để chống ghi nhầm hoặc tạo PR trùng.

Điều tưởng là “tự động” thực ra có khá nhiều điểm dừng đúng chỗ. READY không đồng nghĩa với quyền bỏ qua review; Draft PR là cửa kiểm soát giữa biên tập và phát hành.

Ví dụ ở lần kiểm thử trước, hệ thống tạo [PR #35](https://github.com/duykhang68/techblogtip/pull/35) và ghi K:L chính xác. Nhưng vì đó là bài kiểm thử, PR đã **đóng không merge**. Đây là thành công của kiểm soát, không phải thất bại của Publisher.

## 05. CI và exact SHA: bài được kiểm tra có đúng là bài sẽ đăng?

Hãy tưởng tượng một bản nháp được kiểm tra vào buổi sáng, nhưng buổi chiều lại có thêm commit mới. Nếu chỉ dựa vào dòng chữ “CI đã xanh”, chúng ta có thể xuất bản nội dung chưa từng được kiểm thử.

TechBlogTip chọn cách chặt chẽ hơn: **mỗi kết quả CI gắn với chính xác head SHA của PR**.

- Kiểm tra Astro, nội dung, TypeScript, build và các bài test Publisher.
- Đối chiếu GitHub check-runs với **head SHA hiện tại**, không chấp nhận kết quả commit cũ.
- Giữ Draft-first và review/merge theo hàng đợi, không vượt mặt PR đến trước.
- Sau merge, tiếp tục xác minh release SHA đang được GitHub Pages thực sự phục vụ.

Đây là khác biệt giữa “workflow có màu xanh” và “chúng ta biết chính xác phiên bản nào đã đi qua workflow”.

## 06. Hành trình triển khai có nhiều cú rẽ

Quá trình xây dựng không đi theo đường thẳng hoàn hảo. Một số lỗi nhỏ lại để lại bài học đáng nhớ.

### Cú rẽ 1 — Thanh tiến độ phải nói thật

Ban đầu, người viết khó phân biệt Draft PR, CI, merge và production. Vì vậy chúng tôi thêm stepper **sáu bước** ngay trong Editorial Studio, cùng khu vực **Production Status** hiển thị Actions, hàng đợi PR và môi trường deploy.

Một PR đã merge sẽ hiện **đang chờ xác minh production**, không tự nhảy tới 100%.

### Cú rẽ 2 — GitHub Pages có tiền tố đường dẫn riêng

Production cuối cùng được chọn là [GitHub Pages tại /techblogtip/](https://duykhang68.github.io/techblogtip/), trong khi Publisher DEV vẫn ở Cloudflare Workers.

Điều này đòi hỏi cập nhật đường dẫn nội bộ, phân trang, tìm kiếm, canonical, RSS và sitemap. Nếu quên tiền tố /techblogtip/, trang chủ có thể mở được nhưng liên kết bài viết lại dẫn sai.

Thay đổi này được triển khai qua [PR #43](https://github.com/duykhang68/techblogtip/pull/43).

### Cú rẽ 3 — Deploy thành công nhưng verify thất bại

Một lần GitHub Pages đã tải nội dung thành công, nhưng job xác minh bị lỗi **không tìm thấy script**, vì job deploy chạy trên runner riêng chưa checkout repository.

[PR #44](https://github.com/duykhang68/techblogtip/pull/44) sửa nguyên nhân tận gốc: checkout đúng commit trong deploy job trước khi chạy verifier. Sau đó workflow [#44853772593](https://github.com/duykhang68/techblogtip/actions/runs/44853772593) hoàn thành, bao gồm public release SHA.

Bài học ở đây không nằm ở một dòng YAML; nó nằm ở chỗ **deploy và verify là hai nghĩa vụ độc lập**.

## 07. Production không phải lời hứa, mà là phép đối chiếu

Đây là lớp bảo vệ cuối cùng và cũng là phần tạo ra giá trị thực của hệ thống.

Khi GitHub Pages deploy, public site cung cấp release.json ghi nhận commit SHA. Worker không dừng ở marker đó. Nó còn phải kiểm tra:

- PR chứa bài **đã merge thật**.
- Source revision trong HTML public khớp fingerprint K của Google Sheets.
- URL bài trả về HTTP 200, có canonical đúng và được phép index.
- Commit merge nằm trong lịch sử release SHA; release SHA cũng nằm trong lịch sử main.
- Dữ liệu M:O cũ, nếu có, không bị ghi đè tùy tiện.

Chỉ sau các bước ấy, Worker mới ghi ba ô cuối.

| M · URL public | N · SHA phát hành | O · Thời điểm |
| --- | --- | --- |
| /techblogtip/bai-viet/.../ | 40 ký tự SHA | UTC ISO 8601 |

Khóa theo từng source ID và đọc lại sau khi ghi giúp một lần retry không tạo ra hai “biên lai” cho cùng một bài.

**Điều quan trọng:** Nếu chưa đủ bằng chứng, giữ *pending* là đúng. Trong đợt chạy [#44855403817](https://github.com/duykhang68/techblogtip/actions/runs/44855403817), bộ đồng bộ đã chạy và báo **verified 0, pending 1**; dòng pending là [PR #35](https://github.com/duykhang68/techblogtip/pull/35) đã đóng không merge. Hệ thống từ chối xuất bản nhầm đúng như thiết kế.

## 08. Điều gì thay đổi đối với người viết?

| Trước Publisher | Sau Publisher |
| --- | --- |
| Chuyển nội dung qua nhiều công cụ | Soạn và quản lý từ một bảng biên tập |
| Hỏi nhau “bài lên chưa?” | Theo dõi trực tiếp sáu bước |
| Đoán kết quả qua màu xanh CI | Kiểm chứng đúng commit SHA |
| Merge được xem như đã phát hành | Public URL và nội dung phải được xác minh |
| Trạng thái nằm rải rác | Liên kết PR và biên lai quay về Sheet |

Cách làm này không giấu GitHub. Nó để GitHub làm nhiệm vụ GitHub giỏi nhất, trong khi Google Sheets làm nhiệm vụ người viết cần nhất.

## 09. Ba lớp tin cậy — ba câu hỏi khác nhau

**Editorial — “Đây có đúng là bài tôi đã duyệt?”** Google Sheets giữ nội dung, mã nguồn và fingerprint.

**Engineering — “Bài này có qua quy trình an toàn?”** Draft PR, review, CI exact SHA và merge có bằng chứng.

**Production — “Độc giả có đọc được đúng bản đó không?”** GitHub Pages, public URL, canonical, release marker và M:O writeback trả lời.

Sự tách biệt này giúp chống một loạt lỗi: nhấn gửi hai lần, thay nội dung sau khi nộp, pipeline bị skip, deploy nhầm môi trường, hoặc PR chưa merge mà đã bị gắn nhãn Published.

## 10. Dùng chính bài này làm phép thử thật

Một hệ thống xuất bản chỉ đáng tin khi có **ít nhất một bài thật đi hết đường ống**. Vì vậy, câu chuyện bạn đang đọc chính là nội dung chúng tôi dùng để nghiệm thu mốc cuối: từ dòng Google Sheets, qua Draft PR và CI, đến trang công khai có source revision trùng khớp.

Không cần thành tích hào nhoáng hay số liệu tự bịa. Dấu mốc cuối đơn giản là **ba ô M:O được ghi bằng dữ liệu thật** và Editor chỉ khi đó mới hiển thị **6/6 — Đã đăng thành công**.

Xây dựng Publisher không phải để làm nút “Đăng bài” nhanh hơn vài giây. Đó là cách để người viết nhìn một URL public và biết chắc: **đây đúng là bài đã được duyệt, kiểm thử và phát hành**.

---

**Đọc thêm:** [Mã nguồn TechBlogTip](https://github.com/duykhang68/techblogtip) · [Các workflow phát hành](https://github.com/duykhang68/techblogtip/actions) · [Production blog](https://duykhang68.github.io/techblogtip/)

*Hình minh họa trong bài sử dụng thiết kế pastel và nét icon Lucide theo README TechBlogTip. Các liên kết PR, CI và release được nêu đều trỏ tới bằng chứng công khai.*

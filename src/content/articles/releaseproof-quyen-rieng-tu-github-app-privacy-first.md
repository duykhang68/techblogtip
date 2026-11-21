---
title: "ReleaseProof Privacy by Design: xác minh production mà không cần đọc source code"
description: "Thiết kế quyền riêng tư cho ReleaseProof Web App: sơ đồ dữ liệu, GitHub App read-only, 3 cách kết nối repository, chống SSRF và webhook giả, chính sách xóa dữ liệu."
published: 2026-11-22
category: "Bảo mật"
tags: ["ReleaseProof", "GitHub App", "Privacy by Design", "Cloudflare Workers", "D1", "DevSecOps", "CI/CD", "Bảo mật dữ liệu"]
author: "TechBlogTip"
draft: false
---

Một developer có thể trả tiền để biết bản code nào **đang chạy thật trên production**. Nhưng nếu sản phẩm yêu cầu họ tải source code, file `.env` hoặc token cá nhân lên một website mới, câu trả lời hợp lý sẽ là: **không**. Đây là bài toán thiết kế cốt lõi của **ReleaseProof** — một ý tưởng web app theo dõi bằng chứng triển khai.

Mục tiêu không phải “giữ mọi dữ liệu trong một chiếc két có nhãn bảo mật”, mà là **đừng thu thập những gì không cần**. ReleaseProof chỉ cần dữ liệu để đối chiếu commit kỳ vọng và phiên bản production; ứng dụng không cần đọc nội dung source code. Bài viết dưới đây là **bản thiết kế đề xuất**, không phải tuyên bố ReleaseProof đã triển khai, được chứng nhận an toàn hay có khách hàng thực tế.

<section class="rpp-hero-stats" aria-label="Ba nguyên tắc quyền riêng tư của ReleaseProof">
  <div><strong>0</strong><span>Source code cần lưu</span><small>Mục tiêu thiết kế</small></div>
  <div><strong>0</strong><span>Quyền ghi GitHub cần xin</span><small>MVP chỉ đọc</small></div>
  <div><strong>3</strong><span>Chế độ kết nối lựa chọn</span><small>Public · Private · Push-only</small></div>
</section>

## 1. ReleaseProof thực sự cần lấy dữ liệu gì?

Thay vì hỏi “GitHub cung cấp cho chúng ta những API nào?”, hãy hỏi ngược lại: **cần biết điều gì để chứng minh release đã đến production?**

| Trường dữ liệu | Mục đích | Quy tắc thu thập |
| :-- | :-- | :-- |
| Repository ID, installation ID | Xác định nguồn triển khai và quyền truy cập | **Có**, giới hạn phạm vi tenant |
| Commit SHA kỳ vọng | Mốc đối chiếu | **Có** |
| SHA do production công bố | Bằng chứng từ endpoint sản xuất | **Có**, cùng nguồn và thời gian kiểm tra |
| Deployment status và timestamp | Hiểu quá trình phát hành | **Có**, chỉ các trường cần thiết |
| Tên repo hoặc tên chủ sở hữu | Giúp người dùng nhận diện | **Tùy chọn**, hạn chế hiển thị công khai |
| Source code, file `.env`, artifact và build output | Không cần để so sánh SHA | **Không thu thập** |
| Raw GitHub Actions log | Dễ chứa thông tin vận hành nhạy cảm | **Không tải trong MVP** |
| PR body, commit message, người commit | Không bắt buộc cho release proof | **Tránh thu thập** |

<section class="rpp-data-bins" aria-label="Minh họa dữ liệu được thu thập và dữ liệu phải loại bỏ">
  <div class="rpp-good"><span class="rpp-flag">CHỈ METADATA CẦN THIẾT</span><strong>Repo ID · SHA · status · timestamp</strong><p>Dữ liệu nhỏ, có mục đích đối chiếu, đặt hạn lưu trữ.</p></div>
  <div class="rpp-bad"><span class="rpp-flag">KHÔNG NHẬN / KHÔNG LƯU</span><strong>Source · secrets · token · raw logs</strong><p>Không cần upload file hoặc kết nối quyền đọc mã nguồn để hoàn thành tác vụ chính.</p></div>
</section>

**Metadata vẫn nhạy cảm.** Tên repository private, SHA và lịch deploy có thể tiết lộ lịch ra mắt sản phẩm hoặc liên hệ với nhân sự. “Không lưu code” không đồng nghĩa “không xử lý dữ liệu cá nhân” hay “không có rủi ro”.

## 2. Sơ đồ kiến trúc: dữ liệu đi qua những ranh giới tin cậy nào?

Mô hình đơn giản cho MVP: frontend tĩnh, Cloudflare Worker làm API, D1 lưu những record cần thiết, và GitHub App chỉ xin quyền đọc phù hợp. **Không cần R2 vì không nhận file. Không cần LLM để so sánh SHA.**

<section class="rpp-architecture" data-rpp-architecture aria-label="Sơ đồ luồng dữ liệu ReleaseProof từ GitHub đến bảng điều khiển">
  <div class="rpp-lane"><span>TRUST ZONE A · HẠ TẦNG CỦA KHÁCH</span><strong>GitHub repository + CI/CD</strong><small>Không đưa source, secrets hoặc workflow logs sang ReleaseProof</small></div>
  <div class="rpp-bridge"><span aria-hidden="true">↓</span><small>Read-only metadata hoặc sự kiện đã xác thực</small></div>
  <div class="rpp-lane rpp-border-zone"><span>TRUST BOUNDARY · XÁC THỰC & LỌC</span><strong>GitHub App / Webhook Verification</strong><small>Chọn repository · xác minh chữ ký · giới hạn các trường dữ liệu</small></div>
  <div class="rpp-bridge"><span aria-hidden="true">↓</span><small>Chỉ metadata đã được cho phép</small></div>
  <div class="rpp-lane rpp-blue"><span>TRUST ZONE B · RELEASEPROOF API</span><strong>Cloudflare Worker</strong><small>Xác thực người dùng, tenant isolation, URL safety, đối chiếu expected SHA ↔ live SHA</small></div>
  <div class="rpp-bridge rpp-two-way"><span aria-hidden="true">↓ ↑</span><small>Read/write metadata đã tối thiểu hóa</small></div>
  <div class="rpp-lane rpp-mint"><span>LƯU TRỮ GIỚI HẠN</span><strong>Cloudflare D1</strong><small>Repository ID · release evidence · trạng thái · thời điểm · chính sách xóa</small></div>
  <div class="rpp-bridge"><span aria-hidden="true">↓</span><small>Chỉ truy vấn thuộc tenant có quyền</small></div>
  <div class="rpp-lane rpp-finish"><span>TRẢ KẾT QUẢ CHO NGƯỜI DÙNG</span><strong>Verified · Mismatch · Unverified</strong><small>Đính kèm nguồn bằng chứng, không đánh đồng “CI PASS” với “đã lên production”</small></div>
</section>

Có một đường dữ liệu khác cần xem xét: **Worker đọc endpoint production** như `https://example.com/release.json`. Endpoint này phải là địa chỉ đã được khách xác minh và được kiểm soát SSRF; không được biến ứng dụng thành proxy cho URL tùy ý.

Tài liệu tham khảo: [Cloudflare Workers](https://developers.cloudflare.com/workers/), [Cloudflare D1](https://developers.cloudflare.com/d1/), [GitHub App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app).

## 3. Ma trận quyền GitHub App: chỉ xin tối thiểu

Một GitHub App có thể được cài trên **selected repositories** thay vì toàn bộ tài khoản. Với MVP theo dõi GitHub Actions và deployment, các quyền nên được khảo sát theo từng API thực sự gọi, không cộng tất cả quyền “cho chắc”.

<section class="rpp-perms" aria-label="Ma trận quyền GitHub App đề xuất cho ReleaseProof">
  <div><span class="rpp-perm-name">Metadata</span><strong>Read</strong><small>Bắt buộc theo cơ chế GitHub App</small></div>
  <div><span class="rpp-perm-name">Actions</span><strong>Read*</strong><small>Chỉ khi cần workflow run/status</small></div>
  <div><span class="rpp-perm-name">Checks</span><strong>Read*</strong><small>Chỉ khi cần check run</small></div>
  <div><span class="rpp-perm-name">Deployments</span><strong>Read*</strong><small>Chỉ khi cần trạng thái deploy</small></div>
  <div><span class="rpp-perm-name">Pull requests</span><strong>Read*</strong><small>Chỉ khi bật trace PR → release</small></div>
  <div class="rpp-perm-denied"><span class="rpp-perm-name">Contents / Workflows</span><strong>Không xin</strong><small>Không tải source code hoặc chỉnh YAML</small></div>
  <div class="rpp-perm-denied"><span class="rpp-perm-name">Write / Admin</span><strong>Không xin</strong><small>Không merge, không sửa branch, không đổi secrets</small></div>
</section>

`* Read` **không phải quyền vô hại**. Ví dụ, một số endpoint tải GitHub Actions log chấp nhận quyền **Actions: Read**. ReleaseProof phải không gọi các endpoint đó, kiểm toán egress và xử lý token cẩn thận. Bạn nên giới hạn installation token thêm theo repository/quyền khi API cho phép; token cài đặt GitHub App có thời hạn khoảng **một giờ**. [GitHub — Workflow Runs API](https://docs.github.com/en/rest/actions/workflow-runs) · [Installation tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app).

**Cam kết trung thực:** hiển thị màn hình quyền thực tế trước khi khách đồng ý; chỉ dùng câu “ReleaseProof không cần quyền đọc source code” khi manifest GitHub App và toàn bộ các lệnh gọi API đúng như thiết kế.

## 4. Ba chế độ kết nối để khách tự chọn độ tin cậy

Không phải mọi repository đều cần cách kết nối giống nhau. ReleaseProof có thể đưa ra ba cấp lựa chọn ngay tại màn hình onboarding:

<section class="rpp-modes" data-rpp-modes aria-label="So sánh ba chế độ kết nối và quyền riêng tư">
  <details open>
    <summary><span class="rpp-number">01</span><strong>Public Monitor</strong><span class="rpp-tag">Không cần GitHub token</span></summary>
    <p>Người dùng nhập repository public và URL production. Worker đọc dữ liệu công khai của GitHub cùng manifest công khai của website. Không có quyền truy cập repo private. Có thể bị giới hạn tốc độ và không phù hợp dữ liệu cần bảo mật.</p>
    <small><b>Phù hợp:</b> dự án open-source, website portfolio, gói Free.</small>
  </details>
  <details>
    <summary><span class="rpp-number">02</span><strong>Private Repository</strong><span class="rpp-tag">GitHub App selected repos</span></summary>
    <p>Khách cài GitHub App, chỉ chọn các repo được phép. Backend giữ private key an toàn, tạo installation token ngắn hạn và truy vấn metadata đúng mục đích. Phải có giao diện revoke, log truy cập và cô lập từng khách.</p>
    <small><b>Phù hợp:</b> agency, freelancer quản lý nhiều repo private.</small>
  </details>
  <details>
    <summary><span class="rpp-number">03</span><strong>Push-only</strong><span class="rpp-tag">Không cấp quyền đọc repo</span></summary>
    <p>Một bước trong CI/CD gửi sự kiện tối thiểu có ký/xác thực đến ReleaseProof. Backend không cần đọc repository. Tuy vậy đây là <b>báo cáo từ pipeline của khách</b>, chưa đủ để khẳng định độc lập production đúng SHA; cần kiểm chứng thêm bằng endpoint production hoặc bằng chứng khác.</p>
    <small><b>Phù hợp:</b> nhóm không cho phép cài GitHub App bên ngoài.</small>
  </details>
</section>

Bảng quyết định nhanh:

| Chế độ | Cần quyền vào repo private? | Nguồn bằng chứng | Độ khó vận hành |
| :-- | :-- | :-- | :-- |
| Public Monitor | Không | Public GitHub + public manifest | Thấp |
| Private Repo | Có, chỉ repo đã chọn | GitHub API + production manifest | Trung bình |
| Push-only | Không | CI đã xác thực + manifest độc lập nếu có | Trung bình |

**Chú ý:** một `release.json` công khai chứa SHA chưa tự chứng minh toàn bộ hệ thống backend đang phục vụ đúng version. Bằng chứng cần nói rõ **đo được điều gì, từ endpoint nào, vào lúc nào**. Đối với nhiều service/microservice, phải kiểm tra đúng service hoặc tập hợp service liên quan.

## 5. Threat model: sáu lỗi nguy hiểm phải chặn từ ngày đầu

Dữ liệu ít hơn giúp giảm hậu quả, nhưng không thay thế bảo mật. Đây là sáu tình huống cần đặt thành tiêu chí kiểm thử chứ không chỉ viết trong Privacy Policy.

<section class="rpp-threats" data-rpp-threats aria-label="Sáu lớp phòng vệ an ninh ReleaseProof">
  <div><span>01 · Identity</span><strong>Đọc chéo tenant</strong><p>Không bao giờ nhận `repo_id` từ URL rồi trả record mà chưa kiểm tra tài khoản, installation và membership còn hiệu lực.</p></div>
  <div><span>02 · Input</span><strong>SSRF / DNS rebinding</strong><p>Chỉ xác minh domain do khách kiểm soát; chặn IP nội bộ, redirect ra mạng riêng, URL lạ và phản hồi quá lớn.</p></div>
  <div><span>03 · Webhook</span><strong>Giả mạo & replay</strong><p>Xác thực HMAC `X-Hub-Signature-256` trên raw body, chống trùng `X-GitHub-Delivery`, không tin header chưa xác minh.</p></div>
  <div><span>04 · Credential</span><strong>Lộ installation token</strong><p>Không đưa private key/token xuống trình duyệt, không log Authorization header, dùng secret store và thu hẹp thời gian/quyền token.</p></div>
  <div><span>05 · Data</span><strong>Metadata và log bị lộ</strong><p>Tránh raw payload/log, hạn chế quyền xem D1, lọc thông tin nhạy cảm khỏi telemetry và bản sao lỗi.</p></div>
  <div><span>06 · Proof</span><strong>Gắn nhãn “Verified” sai</strong><p>Nếu mất endpoint, không đối chiếu được SHA hoặc nguồn bằng chứng yếu: trả “Unverified”, không tô xanh mặc định.</p></div>
</section>

Theo GitHub, webhook cần được [xác thực chữ ký](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries) và [chống replay/duplicate](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks). Đặc biệt, chặn SSRF không thể chỉ dùng regex để loại `localhost`; cần kiểm tra DNS, IP, redirect và cả kết nối đi ra.

## 6. Vòng đời dữ liệu: lưu gì, bao lâu, xóa bằng cách nào?

Dữ liệu phải có mục đích và vòng đời. Một ví dụ chính sách cho MVP:

<section class="rpp-retention" aria-label="Dòng thời gian lưu trữ và xóa dữ liệu đề xuất">
  <div><strong>0 ngày</strong><span>Source / raw logs / secrets</span><small>Không tiếp nhận ngay từ đầu</small></div>
  <div><strong>30 ngày*</strong><span>Release evidence gói Free</span><small>Tự xóa theo chính sách đã công bố</small></div>
  <div><strong>90 ngày*</strong><span>Release evidence gói Pro</span><small>Chỉ khi khách đồng ý và có nhu cầu</small></div>
  <div><strong>Disconnect</strong><span>Ngắt quyền, khóa webhook</span><small>Xóa dữ liệu theo quy trình; kiểm soát cả bản sao lưu</small></div>
</section>

`* 30/90 ngày` là **đề xuất thiết kế sản phẩm**, không phải thời hạn bắt buộc theo pháp luật. Một số dữ liệu tài khoản, hóa đơn hoặc hồ sơ bảo mật có thể có nghĩa vụ lưu khác. Muốn nói “đã xóa”, hệ thống phải thực sự thực thi, ghi nhận kết quả và giải thích thời gian xóa khỏi backup.

Nên bổ sung trên dashboard: *Download my evidence*, *Disconnect repository*, *Delete stored data*, xem lại quyền GitHub App, và đường dẫn liên hệ yêu cầu hỗ trợ quyền riêng tư. Khi GitHub App bị uninstall, ngừng truy cập ngay và xác định chính sách xóa phần metadata còn lại.

## 7. Nghĩa vụ pháp lý và cách xây dựng niềm tin

Một chính sách Privacy rõ ràng cần trả lời sáu câu hỏi: **thu thập dữ liệu nào, vì sao, lưu ở đâu, ai nhận dữ liệu, giữ bao lâu, và người dùng yêu cầu xóa/chỉnh sửa bằng cách nào**.

Từ **01/01/2026**, Việt Nam áp dụng [Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15](https://english.luatvietnam.vn/dan-su/law-on-personal-data-protection-law-no-91-2025-qh15-405135-d1.html) và [Nghị định 356/2025/NĐ-CP](https://english.luatvietnam.vn/decree-no-356-2025-nd-cp-dated-december-31-2025-of-the-government-detailing-a-number-of-articles-and-measures-for-the-implementation-of-the-law-on-p-422896-doc1.html). Nếu cung cấp sản phẩm cho khách EU, GDPR có thể liên quan tùy đối tượng, vai trò xử lý dữ liệu và phạm vi hoạt động.

**“Không lưu source code” không giúp được miễn toàn bộ nghĩa vụ bảo vệ dữ liệu.** User ID, email và metadata riêng tư vẫn có thể thuộc phạm vi điều chỉnh. Các nghĩa vụ như đánh giá tác động xử lý dữ liệu hoặc chuyển dữ liệu xuyên biên giới cần được tư vấn dựa trên hoạt động thật; bài viết không thay thế tư vấn pháp lý.

<section class="rpp-trust-card" aria-label="Ví dụ nội dung minh bạch hiển thị ở màn hình kết nối GitHub">
  <span>MINH HỌA UX · KHÔNG PHẢI HỆ THỐNG ĐÃ CHỨNG NHẬN</span>
  <strong>Bạn kiểm soát những gì ReleaseProof có thể truy cập</strong>
  <p>Chọn repository, xem quyền đọc metadata, ngắt kết nối bất kỳ lúc nào. Không yêu cầu upload source code, file môi trường hay personal access token.</p>
  <div><span>Read-only, selected repositories</span><b>Đề xuất MVP</b></div>
  <small>Các quyền được hiển thị phải khớp với GitHub App manifest thật, không chỉ là lời quảng cáo.</small>
</section>

Ngoài Privacy Policy, nên có Security page công khai mô tả kiến trúc, quy trình báo cáo lỗ hổng, ứng phó sự cố, liên hệ support và giới hạn của kết quả “Verified”. **Đừng dùng “zero-knowledge”, “end-to-end encrypted” hay “100% secure” nếu kiến trúc chưa thực sự chứng minh được.**

## 8. Checklist trước khi mở beta cho developer

<section class="rpp-checklist" data-rpp-checklist aria-label="Checklist kiểm thử và nghiệm thu quyền riêng tư ReleaseProof">
  <div><span>01</span><strong>Người dùng không thể upload source, .env hoặc PAT trong luồng mặc định</strong></div>
  <div><span>02</span><strong>GitHub App chỉ có permissions tối thiểu và selected repositories</strong></div>
  <div><span>03</span><strong>Không endpoint nào tải source, Actions logs hay raw artifacts trong MVP</strong></div>
  <div><span>04</span><strong>Gọi API chéo tenant bị chặn, kể cả sau khi bị revoke quyền</strong></div>
  <div><span>05</span><strong>Webhook giả, chữ ký sai và delivery trùng không thay đổi trạng thái</strong></div>
  <div><span>06</span><strong>URL production nội bộ, IP riêng và redirect nguy hiểm bị từ chối</strong></div>
  <div><span>07</span><strong>Missing/invalid SHA trả Unverified, không trả Verified</strong></div>
  <div><span>08</span><strong>Secrets chỉ nằm server-side, được redaction khỏi log và báo lỗi</strong></div>
  <div><span>09</span><strong>Disconnect, export, delete, retention và backup có test đầu-cuối</strong></div>
  <div><span>10</span><strong>Privacy Policy phản ánh đúng hành vi sản phẩm được triển khai</strong></div>
</section>

Khi mười điều kiện này **được kiểm thử và có bằng chứng**, ReleaseProof mới nên mời developer kết nối repository private. Trước đó hãy phát hành **Public Monitor read-only** để thử độ chính xác của phép so sánh SHA với nguồn công khai. MVP này có thể không cần đăng nhập GitHub trong giai đoạn đầu.

**Kết luận:** ReleaseProof đáng tin không phải vì nói “chúng tôi bảo vệ code của bạn”, mà vì **ứng dụng được thiết kế để không cần nhận code của bạn**. Một dịch vụ thu ít dữ liệu, xin ít quyền, xác minh bằng chứng minh bạch và cho phép xóa dữ liệu là nền tảng tốt hơn cho kinh doanh dài hạn.

---

**Nguồn kỹ thuật và pháp lý (đối chiếu 22/11/2026):** [GitHub App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app) · [Installing third-party GitHub Apps](https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party) · [GitHub installation tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app) · [GitHub Actions permissions](https://docs.github.com/en/rest/actions/workflow-runs) · [GitHub webhook validation](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries) · [GitHub webhook best practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks) · [Cloudflare Workers](https://developers.cloudflare.com/workers/) · [Cloudflare D1](https://developers.cloudflare.com/d1/) · [Luật 91/2025/QH15](https://english.luatvietnam.vn/dan-su/law-on-personal-data-protection-law-no-91-2025-qh15-405135-d1.html) · [Nghị định 356/2025/NĐ-CP](https://english.luatvietnam.vn/decree-no-356-2025-nd-cp-dated-december-31-2025-of-the-government-detailing-a-number-of-articles-and-measures-for-the-implementation-of-the-law-on-p-422896-doc1.html).

*Bản thiết kế tham khảo; không phải tuyên bố về bảo mật hoặc tuân thủ pháp luật của một sản phẩm ReleaseProof đang vận hành.*

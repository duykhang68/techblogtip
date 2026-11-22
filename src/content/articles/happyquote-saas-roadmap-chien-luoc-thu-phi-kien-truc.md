---
title: "HappyQuote SaaS Roadmap 2026–2027: chiến lược, kiếm tiền, kiến trúc và bảng giá cho designer"
description: "Roadmap trực quan HappyQuote cho freelance designer: chiến lược Micro-SaaS, Free/Pro 79.000đ, MoMo + Google Sheets, Cloudflare, license và QA đến production."
published: 2026-11-22
category: "Lập trình"
tags: ["HappyQuote", "SaaS", "Micro-SaaS", "Freelancer Designer", "Cloudflare", "GitHub Actions", "Google Sheets", "MoMo", "Product Roadmap"]
author: "TechBlogTip"
draft: false
---

<section class="hq-hero" aria-label="HappyQuote SaaS Business Blueprint">
  <div class="hq-eyebrow">BUSINESS BLUEPRINT · V1.0 · 2026–2027</div>
  <h2>Create beautiful quotes.<br>Protect your work.<br><em>Get paid.</em></h2>
  <p>HappyQuote là web app SaaS dành cho freelancer designer Việt Nam, giúp báo giá chuyên nghiệp, kiểm soát phạm vi công việc, quản lý số vòng sửa và thu tiền đúng thỏa thuận.</p>
  <div class="hq-hero-trio">
    <div><small>01 · KHÁCH HÀNG</small><strong>Solo Designer</strong></div>
    <div><small>02 · DOANH THU</small><strong>Subscription</strong></div>
    <div><small>03 · HẠ TẦNG</small><strong>Cloudflare</strong></div>
  </div>
</section>

> **Trạng thái tài liệu:** Đây là chiến lược và roadmap sản phẩm, **không phải** cam kết tất cả tính năng đã triển khai. Giá và dự báo là giả thuyết cần kiểm chứng trong beta. Bản này được chủ dự án chọn công bố công khai.

## 1. Chiến lược sản phẩm

**HappyQuote không nên trở thành phần mềm kế toán tổng hợp.** Lợi thế cạnh tranh cần tập trung vào một vấn đề cụ thể: designer thường báo giá bằng tin nhắn hoặc file thủ công, sau đó gặp khó khăn khi khách yêu cầu sửa thêm, thay đổi phạm vi công việc hoặc chậm thanh toán.

<section class="hq-pillars" aria-label="Ba trụ cột giá trị sản phẩm">
  <div class="hq-pillar hq-blue"><span class="hq-symbol" aria-hidden="true">✎</span><strong>Quote</strong><p>Báo giá đẹp, rõ hạng mục, số concept và các file bàn giao.</p></div>
  <div class="hq-pillar hq-purple"><span class="hq-symbol" aria-hidden="true">◇</span><strong>Protect</strong><p>Quản lý scope, số lần revision và chi phí phát sinh.</p></div>
  <div class="hq-pillar hq-mint"><span class="hq-symbol" aria-hidden="true">₫</span><strong>Collect</strong><p>Theo dõi đặt cọc, các đợt thanh toán và công nợ.</p></div>
</section>

**Định vị thương mại:** Khách hàng không trả tiền chỉ để xuất PDF. Họ trả tiền để tránh làm thêm miễn phí, giảm thời gian báo giá và quản lý khoản tiền phải thu.

**Tầm nhìn:** Trở thành công cụ báo giá và quản lý phạm vi công việc đơn giản, chuyên nghiệp, có giá hợp lý dành cho freelance designer tại Việt Nam.

**Nhóm khách hàng đầu tiên:** Freelancer thiết kế logo, branding, key visual, social media và ấn phẩm truyền thông. Ưu tiên cá nhân tự vận hành, chưa xây Team plan.

**Giá trị khác biệt:**
- Quote Builder thiết kế riêng cho hạng mục và quy trình làm việc của designer.
- Mô tả rõ số concept, số vòng chỉnh sửa, file bàn giao, thời hạn và chi phí phát sinh.
- PDF có thương hiệu riêng, thuận tiện gửi khách và chốt dự án.
- Theo dõi đặt cọc, thanh toán theo đợt và công nợ.
- Tập trung trải nghiệm mobile-first, thao tác nhanh, không yêu cầu kiến thức kế toán.

**Nguyên tắc MVP:** Làm tốt hành trình từ tạo báo giá đến khách đồng ý trước khi bổ sung phân tích nâng cao, tự động nhắc nợ hay ứng dụng native.

## 2. Cấu trúc giá và mô hình kiếm tiền

<section class="hq-plans" aria-label="Gói giá HappyQuote đề xuất">
  <div class="hq-plan hq-plan-free">
    <div class="hq-plan-top"><span>FREE</span><small>Cho designer bắt đầu</small></div>
    <div class="hq-price">0đ<span>/tháng</span></div>
    <ul><li>3 báo giá/tháng</li><li>Template cơ bản</li><li>PDF có watermark</li><li>Theo dõi thủ công</li></ul>
    <div class="hq-plan-note">Mục tiêu: thu hút người dùng và tạo nhu cầu nâng cấp.</div>
  </div>
  <div class="hq-plan hq-plan-pro">
    <div class="hq-plan-top"><span>DESIGNER PRO</span><small class="hq-tag">Gói chính</small></div>
    <div class="hq-price">79.000đ<span>/tháng</span></div>
    <div class="hq-annual">790.000đ/năm — đề xuất</div>
    <ul><li>Báo giá không giới hạn hợp lý</li><li>PDF theo thương hiệu riêng</li><li>Scope &amp; revision tracking</li><li>Quản lý cọc, công nợ</li><li>Lịch sử phiên bản báo giá</li></ul>
    <div class="hq-plan-note">Mục tiêu: chuyển đổi từ người dùng miễn phí sang thuê bao.</div>
  </div>
</section>

**Free Trial:** Đề xuất 7 ngày trải nghiệm Pro, xác minh qua email và cấp token dùng thử. Trial không cần chuyển tiền MoMo. Cả mức giá **79.000đ/tháng**, **790.000đ/năm** và thời hạn **7 ngày** đều là giả thuyết thương mại cần kiểm chứng trong beta, chưa phải giá niêm yết cuối cùng.

| Gói | Giá đề xuất | Quyền lợi chính |
| :--- | ---: | :--- |
| **Free** | **0đ** | 3 báo giá/tháng, template cơ bản, PDF watermark |
| **Free Trial** | **0đ trong 7 ngày** | Trải nghiệm Pro có giới hạn thời gian |
| **Designer Pro Monthly** | **79.000đ/tháng** | Báo giá, PDF thương hiệu, scope/revision, đặt cọc/công nợ |
| **Designer Pro Annual** | **790.000đ/năm** | Quyền lợi Pro, ưu đãi thanh toán năm |

**Kênh doanh thu giai đoạn đầu:** Đăng ký gói trả phí qua payment link/QR MoMo cố định do chủ sản phẩm cung cấp. Không dùng payment gateway hoặc MoMo API.

### Quy trình thanh toán thủ công

<section class="hq-payment" aria-label="Luồng thanh toán MoMo và kích hoạt license">
  <div class="hq-step"><span>01</span><strong>Khách chọn Pro</strong><small>Email + mã đơn duy nhất</small></div>
  <div class="hq-arrow" aria-hidden="true">→</div>
  <div class="hq-step"><span>02</span><strong>MoMo QR</strong><small>Khách chuyển đúng số tiền</small></div>
  <div class="hq-arrow" aria-hidden="true">→</div>
  <div class="hq-step"><span>03</span><strong>Admin xác nhận</strong><small>Kiểm tra MoMo · Google Sheets: ID + YES</small></div>
  <div class="hq-arrow" aria-hidden="true">→</div>
  <div class="hq-step"><span>04</span><strong>Worker + D1</strong><small>Đối soát, chống cấp trùng</small></div>
  <div class="hq-arrow" aria-hidden="true">→</div>
  <div class="hq-step"><span>05</span><strong>License Email</strong><small>Khách tự copy–paste token</small></div>
</section>

1. Khách chọn Pro, đăng ký email và nhận mã đơn duy nhất.
2. Khách mở link MoMo, chuyển đúng số tiền và ghi mã đơn nếu kênh thanh toán hỗ trợ.
3. Chủ sản phẩm kiểm tra tiền thật trong ứng dụng MoMo.
4. Chủ sản phẩm nhập mã giao dịch và chọn **YES** tại Google Sheets.
5. Apps Script gửi yêu cầu được xác thực cho Cloudflare Worker.
6. D1 kiểm tra đơn hàng, khóa giao dịch chống trùng và ghi kết quả duyệt.
7. Hệ thống phát hành token **32 ký tự ngẫu nhiên**, gửi qua email.
8. Khách chủ động **copy–paste** token để kích hoạt quyền Pro.

**Quy tắc bảo mật:** Không tự động cấp quyền dựa vào nội dung khách nhập. Không cấp hai license từ cùng một mã giao dịch. Không lưu token thô trong D1. Không tự điền token vào biểu mẫu bằng logic ứng dụng.

## 3. Kiến trúc kỹ thuật

<section class="hq-architecture" aria-label="Sơ đồ kiến trúc HappyQuote">
  <div class="hq-arch-layer hq-arch-web"><span>FRONTEND</span><strong>React · TypeScript · Vite</strong><small>Designer Workspace · Quote Builder · Dashboard · PDF · Activation</small></div>
  <div class="hq-arch-connector">↓ <small>HTTPS API · xác thực</small></div>
  <div class="hq-arch-layer hq-arch-api"><span>APPLICATION</span><strong>Cloudflare Workers · Hono</strong><small>Authentication · Quotes · Payments · License Entitlements</small></div>
  <div class="hq-arch-connector">↓ <small>Server-side bindings</small></div>
  <div class="hq-arch-storage">
    <div><span>DATABASE</span><strong>Cloudflare D1</strong><small>Users · Quotes · Orders · Licenses · Audit</small></div>
    <div><span>FILES</span><strong>Cloudflare R2</strong><small>PDF · tệp thương hiệu riêng tư</small></div>
  </div>
  <div class="hq-arch-footer"><strong>Private GitHub → CI/FIFO/CD → Public Cloudflare</strong><small>Google Sheets chỉ duyệt giao dịch · D1 là nguồn dữ liệu cấp quyền chính thức</small></div>
</section>

| Lớp | Công nghệ | Trách nhiệm |
| :--- | :--- | :--- |
| Frontend | React, TypeScript, Vite | Workspace, Quote Builder, Dashboard, Activation |
| Backend API | Cloudflare Workers, Hono | Logic nghiệp vụ, xác thực, cấp quyền |
| Database | Cloudflare D1 | Tài khoản, báo giá, đơn hàng, license, audit |
| File Storage | Cloudflare R2 | Tài liệu PDF và file thương hiệu |
| Admin Approval | Google Sheets, Apps Script | Chủ sản phẩm duyệt giao dịch MoMo thủ công |
| Email | Nhà cung cấp gửi email giao dịch | Phát hành license và thông báo |
| Source Control | GitHub Private | Version control, PR và lịch sử thay đổi |
| CI/CD | GitHub Actions, FIFO | Kiểm thử, merge tuần tự, deploy |
| Hosting | Cloudflare Workers | Staging, production, API |

Mã nguồn giữ trong GitHub Private trên nhánh **main**. GitHub Actions chịu trách nhiệm CI/FIFO/CD; Cloudflare phục vụ app công khai. Sau này có thể bổ sung vỏ ứng dụng macOS/iOS, tái sử dụng phần TypeScript và API.

**Kiến trúc tương lai:** Tách logic nghiệp vụ dùng chung khỏi UI và cơ chế lưu trữ, giúp mở rộng sang macOS/iOS mà không phải xây lại backend.

## 4. Roadmap triển khai 2026–2027

<section class="hq-roadmap" aria-label="Timeline roadmap HappyQuote từ P0 đến P8">
  <div style="--hq-stage:#596F8C"><span>P0</span><div><strong>Stabilize Platform</strong><small>CI, FIFO, Cloudflare CD, exact SHA</small></div><em>Chưa nghiệm thu</em></div>
  <div style="--hq-stage:#3861CB"><span>P1</span><div><strong>Designer Workspace</strong><small>Đăng nhập, hồ sơ thương hiệu, khách hàng</small></div><em>Kế hoạch</em></div>
  <div style="--hq-stage:#8050C7"><span>P2</span><div><strong>Quote Builder</strong><small>Concept, revision, giá, cọc, deadline</small></div><em>Kế hoạch</em></div>
  <div style="--hq-stage:#B84C9C"><span>P3</span><div><strong>Branded Proposal &amp; PDF</strong><small>PDF, chia sẻ, khách duyệt, khóa phiên bản</small></div><em>Kế hoạch</em></div>
  <div style="--hq-stage:#B37B19"><span>P4</span><div><strong>Manual MoMo Billing</strong><small>Order ID, QR, Google Sheets: transaction + YES</small></div><em>Nghiệp vụ đã chốt</em></div>
  <div style="--hq-stage:#19845E"><span>P5</span><div><strong>Licensing Engine</strong><small>Email token 32 ký tự, kích hoạt và gia hạn</small></div><em>Kế hoạch</em></div>
  <div style="--hq-stage:#1887A4"><span>P6</span><div><strong>Freelance Operations</strong><small>Scope changes, tiến độ, công nợ</small></div><em>Kế hoạch</em></div>
  <div style="--hq-stage:#C86455"><span>P7</span><div><strong>Commercial Beta</strong><small>QA bảo mật, E2E, thử nghiệm giá</small></div><em>Kế hoạch</em></div>
  <div style="--hq-stage:#485EC8"><span>P8</span><div><strong>SaaS Launch</strong><small>Production verified, retention và doanh thu</small></div><em>Kế hoạch</em></div>
</section>

### Các milestone và tiêu chí nghiệm thu

**P0 — Platform Foundation:** Ổn định CI/CD, FIFO, Secrets, quy trình deploy và xác minh production bằng full SHA.

**P1 — Identity & Workspace:** Tài khoản người dùng, email verification, studio profile, thương hiệu và danh bạ khách hàng.

**P2 — Designer Quote Builder:** Danh mục dịch vụ thiết kế, concept, revision, đơn giá, VAT nếu áp dụng, đặt cọc, milestone và deadline.

**P3 — Proposals & PDF:** PDF có logo, link chia sẻ, xác nhận đồng ý, bảo vệ phiên bản đã được khách duyệt.

**P4 — Manual Payment Administration:** Payment order, QR MoMo cố định, Google Sheets với mã giao dịch + YES, đối soát và audit.

**P5 — Licensing:** Token 32 ký tự, email delivery, kích hoạt thủ công, giới hạn Free/Pro, thời hạn và gia hạn.

**P6 — Project Operations:** Theo dõi báo giá, các lần sửa, tiến độ dự án, công nợ và khoản thanh toán còn thiếu.

**P7 — Commercial Beta:** Mời nhóm designer dùng thử, kiểm tra bảo mật, E2E và kiểm chứng mức giá.

**P8 — Public SaaS Launch:** Mở bán sau khi production được nghiệm thu, phát triển nội dung hướng dẫn và các kênh thu hút khách hàng.

**Quy tắc phát hành:** Mỗi bước phải có unit tests, integration tests, E2E, security checks, CI đúng head SHA, staging QA và bằng chứng production. Chỉ khi đạt gate mới coi là hoàn thành. Theo trạng thái dự án tại thời điểm viết, P0 vẫn chưa được nghiệm thu production.

## 5. Thước đo kinh doanh và kỹ thuật

<section class="hq-metrics" aria-label="Nhóm KPI HappyQuote">
  <div><span>PRODUCT</span><strong>Activation &amp; Usage</strong><small>Đăng ký · Báo giá đầu tiên · Báo giá gửi · 30-day reuse</small></div>
  <div><span>REVENUE</span><strong>MRR &amp; Retention</strong><small>Free → Pro · Doanh thu · Gia hạn · Hết hạn</small></div>
  <div><span>ENGINEERING</span><strong>Release Confidence</strong><small>CI PASS · Merge → Prod · Exact SHA · PDF / License errors</small></div>
</section>

**Product KPIs:** Người đăng ký, tỷ lệ tạo báo giá đầu tiên, số báo giá gửi đi, số báo giá được chấp nhận, tỷ lệ dùng lại sau 30 ngày.

**Revenue KPIs:** Free → Pro conversion, MRR, số khách gia hạn, tỷ lệ hết hạn không gia hạn, doanh thu theo tháng/năm.

**Engineering KPIs:** CI pass rate, thời gian merge → production, exact-SHA verification, tỷ lệ phát hành thất bại, tỷ lệ lỗi PDF và license activation.

**Mục tiêu chất lượng web:** Mobile LCP không quá **2,5 giây**, INP không quá **200ms** và CLS không quá **0,1** trên thiết bị/kết nối đo kiểm phù hợp.

## 6. Quy tắc triển khai và phát hành

- Từng milestone có acceptance criteria và bộ test thực tế.
- Mỗi PR phải qua CI, Security, Conflict, FIFO và Aggregate Gate.
- Merge chỉ thực hiện trên đúng head SHA đã qua kiểm thử.
- Staging QA phải PASS trước khi triển khai production.
- Production chỉ được đánh dấu VERIFIED khi Web/API thực tế trả đúng full SHA.
- Ghi commit SHA, PR number, CI/CD run IDs và changelog version vào tab **Changelog**.
- Ghi thời gian CI/CD và thời gian phát hành vào tab **Deploy time**.
- Không công bố tính năng hoặc doanh thu giả định là kết quả đã đạt được.

## 7. Chiến lược ra thị trường

<section class="hq-gtm" aria-label="Go-to-market HappyQuote theo bốn giai đoạn">
  <div><span>01</span><strong>Private Beta</strong><small>10–20 freelancer · Báo giá dự án thật · Phỏng vấn</small></div>
  <div><span>02</span><strong>Paid Beta</strong><small>Thử Pro · Xác minh MoMo thủ công · Kiểm chứng giá</small></div>
  <div><span>03</span><strong>Public Launch</strong><small>Web · Mẫu báo giá · Video hướng dẫn · SEO</small></div>
  <div><span>04</span><strong>Retention</strong><small>Template chuyên ngành · Scope · Công nợ · Tái sử dụng</small></div>
</section>

**Bước 1 — Private beta:** Mời 10–20 freelancer designer sử dụng Quote Builder với dự án thực tế, ghi nhận thời gian tiết kiệm và phản hồi.

**Bước 2 — Paid beta:** Mời nhóm dùng thử nâng cấp Pro; vận hành thanh toán MoMo thủ công để đo nhu cầu trả tiền mà không tốn chi phí tích hợp gateway.

**Bước 3 — Public launch:** Xuất bản website, mẫu báo giá, video hướng dẫn ngắn và nội dung giải quyết những tình huống thực tế của designer.

**Bước 4 — Retention:** Cải thiện tốc độ tạo báo giá, template theo loại thiết kế và khả năng theo dõi scope/công nợ dựa trên phản hồi.

**Điều kiện mở rộng sang macOS/iOS:** Web SaaS phải có hoạt động sử dụng lặp lại, có khách trả phí và các vấn đề thực sự được cải thiện nhờ ứng dụng native.

---

<section class="hq-final" aria-label="Ưu tiên đầu tiên HappyQuote">
  <span>EXECUTIVE PRIORITY</span>
  <strong>Quote Builder → PDF → Khách chấp nhận báo giá</strong>
  <p>Đây là phần tạo ra giá trị mà khách hàng sẽ trả tiền. Hệ thống MoMo và licensing là lớp thương mại hóa xây phía sau.</p>
</section>

**Trạng thái tài liệu:** Roadmap chiến lược, không phải xác nhận đã triển khai P1–P8. P0 cần hoàn tất nghiệm thu production trước khi công bố phiên bản thương mại. Bài viết công khai là kế hoạch sản phẩm, không phải trang đặt mua đang vận hành.

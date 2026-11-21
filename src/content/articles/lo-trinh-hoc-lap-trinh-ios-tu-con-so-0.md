---
title: "Roadmap học lập trình iOS từ con số 0: 24 tuần tự làm app iPhone"
description: "Lộ trình 24 tuần học Swift, SwiftUI, Xcode từ con số 0 đến tự làm ứng dụng iPhone: sơ đồ 9 giai đoạn, checklist tương tác và lịch học mỗi ngày."
published: 2026-11-22
category: "Lập trình"
tags: ["iOS", "Swift", "SwiftUI", "Xcode", "Mobile App", "Roadmap", "Apple", "Người mới bắt đầu"]
author: "TechBlogTip"
draft: false
---

**Mục tiêu:** đi từ người chưa biết lập trình đến tự thiết kế giao diện, viết code, lưu dữ liệu, chạy trên iPhone và chuẩn bị đưa ứng dụng lên App Store. Hướng đi thẳng là **Swift + SwiftUI**, không bắt buộc học Python hay Java trước.

<section class="iosr-facts" aria-label="Thông số lộ trình">
  <div><strong>24</strong><span>Tuần học</span></div>
  <div><strong>9</strong><span>Giai đoạn</span></div>
  <div><strong>1</strong><span>App hoàn chỉnh</span></div>
  <p>Dự kiến 6 tháng · 8–12 giờ học/tuần · Không yêu cầu kiến thức nền. Thời lượng chỉ mang tính tham khảo, không phải cam kết tiến độ.</p>
</section>

## 1. Sơ đồ lộ trình học trực quan

Từ lúc cài Xcode đến khi gửi app lên App Review, mỗi chặng được gắn với một kỹ năng và một mốc thời gian rõ ràng.

<section class="iosr-map" aria-label="Sơ đồ 9 giai đoạn học lập trình iOS">
  <div class="iosr-endpoint"><span aria-hidden="true">●</span> START — CHƯA BIẾT CODE <small>Xuất phát từ con số 0</small></div>
  <ol class="iosr-steps">
    <li style="--stage:#66768a"><span class="iosr-number">01</span><div><strong>Làm quen công cụ</strong><small>Tuần 1</small><p>Mac · Xcode · Git · iPhone Simulator</p></div></li>
    <li style="--stage:#0d9488"><span class="iosr-number">02</span><div><strong>Tư duy lập trình</strong><small>Tuần 2–3</small><p>Biến · Điều kiện · Vòng lặp · Hàm</p></div></li>
    <li style="--stage:#c45a25"><span class="iosr-number">03</span><div><strong>Ngôn ngữ Swift</strong><small>Tuần 4–6</small><p>Optional · Array · Struct · Class · Protocol</p></div></li>
    <li style="--stage:#2563a8"><span class="iosr-number">04</span><div><strong>Giao diện SwiftUI</strong><small>Tuần 7–10</small><p>View · Layout · State · Forms · Animation</p></div></li>
    <li style="--stage:#8055ab"><span class="iosr-number">05</span><div><strong>Cấu trúc ứng dụng</strong><small>Tuần 11–13</small><p>Navigation · Components · MVVM cơ bản</p></div></li>
    <li style="--stage:#09859a"><span class="iosr-number">06</span><div><strong>Lưu trữ dữ liệu</strong><small>Tuần 14–16</small><p>SwiftData · CRUD · Persistence</p></div></li>
    <li style="--stage:#a07516"><span class="iosr-number">07</span><div><strong>Kết nối Internet</strong><small>Tuần 17–18</small><p>REST API · JSON · async/await</p></div></li>
    <li style="--stage:#b34c7a"><span class="iosr-number">08</span><div><strong>Xây app hoàn chỉnh</strong><small>Tuần 19–22</small><p>Tự code · Debug · Test trên iPhone</p></div></li>
    <li style="--stage:#2b8a54"><span class="iosr-number">09</span><div><strong>Kiểm thử và phát hành</strong><small>Tuần 23–24</small><p>TestFlight · App Store Connect</p></div></li>
  </ol>
  <div class="iosr-endpoint iosr-finish"><span aria-hidden="true">✓</span> FINISH — iOS APP DEVELOPER <small>Có app thật, mã nguồn GitHub và bản phát hành thử nghiệm hoặc đã gửi duyệt</small></div>
</section>

## 2. Checklist chi tiết — học gì và làm được gì?

Đánh dấu một giai đoạn **chỉ khi dự án nhỏ của giai đoạn đó chạy được**. Checklist và lịch học có thể ghi nhớ trên trình duyệt hiện tại; nếu xóa dữ liệu trình duyệt hoặc đổi thiết bị, trạng thái có thể mất. Toàn bộ nội dung vẫn đọc được khi tắt JavaScript.

<section class="iosr-checklist" data-ios-roadmap-checklist aria-label="Checklist lộ trình học iOS">
  <div class="iosr-checkhead">
    <div><strong>Tiến độ học tập</strong><span data-ios-progress-label aria-live="polite">0/9 giai đoạn</span></div>
    <div class="iosr-progress" role="progressbar" aria-label="Tiến độ học lập trình iOS" aria-valuemin="0" aria-valuemax="9" aria-valuenow="0" data-ios-progress><span data-ios-progress-fill></span></div>
  </div>
  <ol class="iosr-checkitems">
    <li><label><input type="checkbox" data-ios-task="0"><span><strong>1. Chuẩn bị môi trường <small>Tuần 1</small></strong><span>Cài Xcode, tạo Apple Account, học Simulator, Terminal cơ bản và Git/GitHub.</span><em>Sản phẩm: Chạy app Hello iPhone đầu tiên.</em></span></label></li>
    <li><label><input type="checkbox" data-ios-task="1"><span><strong>2. Nắm vững tư duy lập trình <small>Tuần 2–3</small></strong><span>Biến, kiểu dữ liệu, toán tử, if/else, switch, for, while, hàm và cách tìm lỗi.</span><em>Sản phẩm: Máy tính tiền hoặc trò chơi đoán số.</em></span></label></li>
    <li><label><input type="checkbox" data-ios-task="2"><span><strong>3. Học Swift nền tảng <small>Tuần 4–6</small></strong><span>Array, Dictionary, Optional, struct, class, enum, protocol, closure và xử lý lỗi.</span><em>Sản phẩm: Ứng dụng quản lý danh sách công việc bằng Swift.</em></span></label></li>
    <li><label><input type="checkbox" data-ios-task="3"><span><strong>4. Tự thiết kế giao diện SwiftUI <small>Tuần 7–10</small></strong><span>Text, Button, Image, VStack/HStack, List, Form, @State, @Binding và bố cục responsive.</span><em>Sản phẩm: App To-do có ba màn hình và tương tác thật.</em></span></label></li>
    <li><label><input type="checkbox" data-ios-task="4"><span><strong>5. Quản lý luồng và kiến trúc app <small>Tuần 11–13</small></strong><span>NavigationStack, TabView, tách component, quản lý state, MVVM cơ bản và tổ chức thư mục.</span><em>Sản phẩm: App năm màn hình chuyển qua lại và chia sẻ dữ liệu.</em></span></label></li>
    <li><label><input type="checkbox" data-ios-task="5"><span><strong>6. Lưu dữ liệu thật <small>Tuần 14–16</small></strong><span>CRUD, SwiftData, lưu dữ liệu qua lần đóng/mở app, tìm kiếm và bộ lọc.</span><em>Sản phẩm: App ghi chú offline, không mất dữ liệu khi mở lại.</em></span></label></li>
    <li><label><input type="checkbox" data-ios-task="6"><span><strong>7. Làm việc với API <small>Tuần 17–18</small></strong><span>HTTP, REST, JSON, URLSession, Codable, async/await, trạng thái tải, lỗi mạng và bảo vệ dữ liệu.</span><em>Sản phẩm: App thời tiết hoặc tra cứu dữ liệu từ API công khai.</em></span></label></li>
    <li><label><input type="checkbox" data-ios-task="7"><span><strong>8. Tự làm ứng dụng hoàn chỉnh <small>Tuần 19–22</small></strong><span>Thiết kế UX, xây màn hình, tích hợp dữ liệu, kiểm thử luồng chính, sửa bug và tối ưu.</span><em>Sản phẩm: Habit Tracker hoặc app quản lý chi tiêu dùng được hằng ngày.</em></span></label></li>
    <li><label><input type="checkbox" data-ios-task="8"><span><strong>9. Kiểm thử và phát hành <small>Tuần 23–24</small></strong><span>XCTest, kiểm tra Accessibility, icon, screenshot, privacy, TestFlight và App Store Connect.</span><em>Sản phẩm: Bản beta cho người dùng thử; gửi app lên App Review khi sẵn sàng.</em></span></label></li>
  </ol>
  <button type="button" class="iosr-reset" data-ios-reset>Đặt lại checklist</button>
</section>

## 3. Sau 6 tháng, ứng dụng bạn làm có thể trông thế nào?

Dự án tốt để học trọn quy trình là **HabitFlow — Theo dõi thói quen hằng ngày**. Bạn xây app có màn hình tổng quan và thống kê. Hai hình dưới là **minh họa giao diện tự dựng bằng HTML/CSS**, không phải ảnh chụp app iOS đã được lập trình.

<section class="iosr-previews" aria-label="Hai mẫu màn hình ứng dụng HabitFlow">
  <figure><div class="iosr-phone" aria-label="Minh họa Home Dashboard"><div class="iosr-phonebar">9:41 <span>●●●</span></div><div class="iosr-phonebody"><span class="iosr-overline">GOOD MORNING</span><h3>My habits</h3><p>Hôm nay mình sẽ làm tốt hơn ✨</p><div class="iosr-ringline"><div class="iosr-ring"><b>75%</b></div><div><strong>3 / 4</strong><small>Thói quen hoàn thành</small></div></div><div class="iosr-habit">✓ <span>Đọc 20 phút</span> <b>12 ngày</b></div><div class="iosr-habit">✓ <span>Uống đủ nước</span> <b>8 ngày</b></div><div class="iosr-habit iosr-pending">○ <span>Học Swift</span> <b>6 ngày</b></div><div class="iosr-habit">✓ <span>Đi bộ</span> <b>4 ngày</b></div></div><div class="iosr-tabbar">⌂ &nbsp; ◷ &nbsp; ▦</div></div><figcaption><strong>Home Dashboard</strong><span>Tiến độ, thói quen và chuỗi ngày duy trì</span></figcaption></figure>
  <figure><div class="iosr-phone" aria-label="Minh họa Statistics"><div class="iosr-phonebar">9:41 <span>●●●</span></div><div class="iosr-phonebody"><span class="iosr-overline">YOUR GROWTH</span><h3>Statistics</h3><p>Mỗi ngày một chút tiến bộ 🌱</p><div class="iosr-stat"><small>Tỷ lệ hoàn thành</small><strong>82% <span>↗ +8%</span></strong></div><div class="iosr-week" aria-label="Biểu đồ tỷ lệ hoàn thành bảy ngày"><i style="height:52%"></i><i style="height:75%"></i><i style="height:63%"></i><i style="height:95%"></i><i style="height:80%"></i><i style="height:99%"></i><i style="height:82%"></i></div><div class="iosr-weeklabels">T2 T3 T4 T5 T6 T7 CN</div><strong class="iosr-calheading">November 2026</strong><div class="iosr-calendar" aria-hidden="true"> <span>●</span><span>◌</span><span>●</span><span>●</span><span>◌</span><span>●</span><span>●</span><span>●</span><span>●</span><span>◌</span><span>●</span><span>●</span><span>●</span><span>◌</span><span>●</span><span>●</span><span>●</span><span>●</span><span>◌</span><span>●</span><span>●</span></div></div><div class="iosr-tabbar">⌂ &nbsp; ◷ &nbsp; ▦</div></div><figcaption><strong>Statistics</strong><span>Lịch sử, biểu đồ và tỷ lệ hoàn thành</span></figcaption></figure>
</section>

**Năm chức năng cho phiên bản đầu tiên:** thêm thói quen, chỉnh sửa/xóa, đánh dấu hoàn thành, lưu dữ liệu trên máy và xem thống kê. Sau khi app hoạt động ổn định mới thêm thông báo nhắc nhở và đồng bộ đám mây. Không cần xây login hoặc backend phức tạp ngay từ ngày đầu.

## 4. Bộ công nghệ cần học

<section class="iosr-tech" aria-label="Bốn công nghệ quan trọng nhất cho iOS">
  <div><span class="iosr-techicon iosr-swift">S</span><strong>Swift</strong><small>Ngôn ngữ lập trình ứng dụng</small></div>
  <div><span class="iosr-techicon iosr-xcode">X</span><strong>Xcode</strong><small>IDE: viết code, build và kiểm thử</small></div>
  <div><span class="iosr-techicon iosr-swiftui">UI</span><strong>SwiftUI</strong><small>Framework tạo giao diện</small></div>
  <div><span class="iosr-techicon iosr-github">GH</span><strong>GitHub</strong><small>Lưu lịch sử và quản lý mã nguồn</small></div>
</section>

Sau đó học **SwiftData** để lưu dữ liệu, **URLSession** để gọi API và **XCTest** để kiểm thử. Chưa cần học Python, Java, Kotlin hay React Native trước khi bắt đầu nếu mục tiêu là một app iPhone native. Apple cung cấp Xcode và Simulator để bạn có thể bắt đầu trên Mac mà chưa cần một iPhone riêng.

## 5. Tài liệu học miễn phí, theo thứ tự

1. **[Hello, SwiftUI — Apple](https://developer.apple.com/tutorials/develop-in-swift/hello-swiftui)** — bài thực hành đầu tiên, tạo project và sửa giao diện iOS.
2. **[The Swift Programming Language](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/)** — tài liệu chính thống về cú pháp và tính năng của Swift.
3. **[Welcome to app development — Apple](https://developer.apple.com/tutorials/develop-in-swift/welcome-to-app-development)** — đưa các kỹ năng Xcode, Swift, SwiftUI vào một dự án ứng dụng.
4. **[Get Started — Apple Developer](https://developer.apple.com/get-started/)** — tổng quan hệ sinh thái và bước tiếp theo để phát triển app.

Không cần đọc trọn mọi tài liệu trước khi code. Gặp khái niệm nào trong dự án, mở đúng chương liên quan, thử sửa ví dụ rồi quay lại ứng dụng đang xây dựng.

## 6. Lịch học đề xuất mỗi ngày

Chọn quỹ thời gian gần với thực tế của bạn. Nếu học 5–6 ngày một tuần, lịch **2 giờ/ngày** tương đương khoảng 10–12 giờ/tuần và phù hợp với mốc 24 tuần tham khảo.

<section class="iosr-schedule" data-ios-roadmap-schedule aria-label="Chọn lịch học theo thời gian mỗi ngày">
  <div class="iosr-pills" role="group" aria-label="Số giờ học mỗi ngày">
    <button type="button" data-ios-hours="1" aria-pressed="false">1 giờ</button>
    <button type="button" data-ios-hours="2" aria-pressed="true">2 giờ</button>
    <button type="button" data-ios-hours="3" aria-pressed="false">3 giờ</button>
  </div>
  <div class="iosr-plan" data-ios-plan="1" hidden><div><b>20 phút</b><span>Học một khái niệm</span></div><div><b>30 phút</b><span>Thực hành code</span></div><div><b>10 phút</b><span>Sửa lỗi và ghi chú</span></div></div>
  <div class="iosr-plan" data-ios-plan="2"><div><b>25 phút</b><span>Học lý thuyết</span></div><div><b>70 phút</b><span>Tự viết code và tính năng</span></div><div><b>25 phút</b><span>Debug, đọc tài liệu, commit Git</span></div></div>
  <div class="iosr-plan" data-ios-plan="3" hidden><div><b>40 phút</b><span>Học kiến thức mới</span></div><div><b>110 phút</b><span>Làm mini project</span></div><div><b>30 phút</b><span>Test và cải thiện code</span></div></div>
  <p>Không có quỹ thời gian “đúng” cho tất cả. Ít giờ hơn thì tăng số tuần; nhiều giờ hơn chỉ thực sự có ích khi dành phần lớn thời gian tự code và xử lý lỗi.</p>
</section>

## 7. Học và phát hành app iOS tốn bao nhiêu?

Bạn có thể **học Swift, build ứng dụng và thử trên thiết bị cá nhân** bằng Apple Account miễn phí, với một số giới hạn ký và cài app thử nghiệm. Xcode miễn phí nhưng cần Mac tương thích phiên bản Xcode đang sử dụng.

Để phát hành qua App Store theo quy trình thông thường, **Apple Developer Program có mức phí 99 USD/năm**, hoặc mức giá bằng nội tệ nơi áp dụng; kiểm tra lại [trang thông tin hội viên của Apple](https://developer.apple.com/help/account/membership/program-enrollment/) trước khi thanh toán. TestFlight và việc gửi duyệt cũng phụ thuộc tài khoản/phân quyền phát hành tương ứng. Việc gửi app lên App Review **không đồng nghĩa chắc chắn được Apple duyệt**.

## 8. Nguyên tắc quan trọng nhất để học đến đích

**Đừng đợi học hết Swift mới bắt đầu làm ứng dụng.** Ngay tuần đầu, hãy mở Xcode, thay vài dòng giao diện và chạy app đầu tiên. Mỗi chặng kết thúc bằng một sản phẩm chạy được, dù còn đơn giản.

Với lộ trình này, khoảng tuần 16 bạn có thể có ứng dụng offline đầu tay; đến tuần 22–24 có thể sẵn sàng thử nghiệm TestFlight hoặc gửi duyệt App Store, **tùy thời gian học, độ phức tạp và chất lượng kiểm thử**. Lộ trình dành cho việc tự xây một sản phẩm đầu tiên, không phải lời hứa thành thạo mọi lĩnh vực iOS chỉ sau 6 tháng.

**Cách kiểm tra bản thân:** khi tự làm lại dự án không phải sao chép nguyên tutorial, biết đọc thông báo lỗi, quản lý source bằng Git và có thể giải thích vì sao app lưu/hiển thị dữ liệu đúng, bạn đang tiến bộ thực chất.

---
title: "Có mã nguồn iOS rồi, làm sao đóng gói thành app và gửi Apple duyệt?"
description: "Hướng dẫn trực quan từ GitHub và Xcode đến archive, ký số, IPA, TestFlight, App Store Connect, Apple App Review và phát hành lên App Store."
published: 2026-11-22
category: "Lập trình"
tags: ["iOS", "Xcode", "App Store", "App Store Connect", "TestFlight", "IPA", "Code Signing", "Apple Review", "GitHub"]
author: "TechBlogTip"
draft: false
---

Bạn đã vibe-code xong một ứng dụng iPhone, mã nguồn đã nằm trên GitHub và màn hình chạy ổn. Vậy làm cách nào để biến những file Swift, Flutter hay React Native thành **một ứng dụng thật mà người khác tìm được trên App Store**?

Đây là giai đoạn *release engineering*: chuẩn bị môi trường, build bản phát hành, ký số, thử nghiệm, cung cấp thông tin ứng dụng, nộp bản build để Apple xem xét và cuối cùng mới phát hành. Bài này dành cho **solo developer**, kể cả người có mã nguồn nhưng chưa từng mở Xcode.

**Điều cần phân biệt:** Apple không duyệt repository GitHub. Apple duyệt **bản build ứng dụng cùng metadata và hành vi thực tế của nó**. Bạn có thể tải bản build lên thành công nhưng vẫn chưa vượt qua App Review.

## 1. Toàn bộ quy trình: từ source code đến App Store

Hãy đọc sơ đồ tám chặng bên dưới theo thứ tự. Trong quá trình thật, tạo app record trên App Store Connect có thể thực hiện trước khi archive/upload; sơ đồ tập trung vào dòng bàn giao bản build để dễ nhớ.

| Chặng | Bạn thực hiện | Kết quả |
| --- | --- | --- |
| 01 — Source | Hoàn thiện mã nguồn, asset, dependencies | Repo GitHub |
| 02 — Build | Biên dịch bằng Xcode và iOS SDK | Bản app chạy trên iOS |
| 03 — Signing | Chọn Apple Developer Team, Bundle ID, capability | Bản build có chữ ký phân phối hợp lệ |
| 04 — Archive | Chọn `Product → Archive` trong Xcode | File `.xcarchive` |
| 05 — Upload | `Distribute App` → App Store Connect → Upload | Build xuất hiện sau khi Apple xử lý |
| 06 — TestFlight | Phân phối beta cho tester, ghi nhận lỗi | Bản build đã được thử nghiệm |
| 07 — App Review | Điền metadata, chọn build, `Submit for Review` | Bản nộp chờ Apple đánh giá |
| 08 — Release | Chọn chế độ phát hành sau khi được duyệt | Ứng dụng có thể xuất hiện trên App Store |

**TestFlight là bước rất nên làm nhưng không phải yêu cầu bắt buộc cho mọi lần nộp App Review.** Với nhóm tester bên ngoài, bản build beta có thể cần qua quy trình TestFlight App Review riêng. Việc bản beta được chấp thuận **không thay thế** xét duyệt phát hành chính thức.

## 2. GitHub, .app, .xcarchive và .ipa khác nhau thế nào?

Đây là bốn thứ rất dễ bị gọi nhầm là “file app”.

| Hiện vật | Vai trò | Có gửi trực tiếp cho Apple để duyệt? |
| --- | --- | --- |
| `GitHub repository` | Lưu source, cấu hình, tài nguyên; có thể chứa dự án Swift, Flutter hoặc React Native | Không |
| `.app` | Bundle ứng dụng đã biên dịch, gồm executable và tài nguyên | Không phải cách nộp thông dụng |
| `.xcarchive` | Archive do Xcode tạo để phục vụ phân phối và giữ thông tin build | Có thể chọn archive rồi upload **trực tiếp từ Xcode** |
| `.ipa` | iOS package archive có thể xuất ra khi cần phân phối hoặc upload qua công cụ phù hợp | Có, nếu được ký và đóng gói đúng kiểu phân phối |

Ví dụ cây thư mục minh họa:

```text
MyiOSApp/                     ← Source code trên GitHub
├── MyiOSApp.xcodeproj
├── Sources/
├── Assets.xcassets/
└── ...
       │  Xcode: Build + Sign + Archive
       ▼
MyiOSApp.xcarchive            ← Archive trên máy hoặc CI
       ├─ Products/Applications/MyiOSApp.app
       └─ dSYMs/
       │
       ├── Upload từ Xcode ───────────→ App Store Connect
       └── Export (khi cần) → MyiOSApp.ipa → công cụ upload
```

**Không cần cố tạo file `.ipa` bằng tay.** Đường dễ nhất với người mới là để Xcode tạo `.xcarchive`, rồi chọn upload từ cửa sổ Organizer. IPA là một nhánh tùy quy trình, không phải “bài thi” bắt buộc trước App Store.

Nếu mã nguồn là **Flutter**, bạn vẫn cần iOS target và công cụ build iOS, thường thông qua Flutter kết hợp Xcode. Với **React Native/Expo/Capacitor**, phần iOS tương ứng cũng phải được build thành ứng dụng iOS có ký số. Một website bình thường không tự biến thành ứng dụng được Apple chấp thuận chỉ vì đổi tên file.

## 3. Trước khi đóng gói: tài khoản, bundle ID và chữ ký

Để phân phối qua App Store, bạn cần đăng ký **Apple Developer Program**. Mức phí tiêu chuẩn theo Apple là **99 USD/năm** (có thể được thu bằng tiền địa phương, thuế và điều kiện áp dụng tùy quốc gia). Tài khoản Apple miễn phí giúp học và thử nghiệm một số tác vụ trên thiết bị, **không thay thế** membership phát hành App Store.

Ba thành phần kỹ thuật quan trọng:

- **Bundle Identifier** là định danh của app, ví dụ `com.example.habitflow`. Giá trị này phải tương ứng giữa target Xcode, App ID và app record ở App Store Connect.
- **Signing Certificate** xác nhận ai là bên ký ứng dụng. Không lưu private key hoặc file chứa bí mật vào GitHub công khai.
- **Provisioning Profile / Entitlements** cho biết app được phép phân phối và sử dụng những khả năng nào. Với dự án cơ bản, Xcode có thể quản lý signing tự động.

Trong Xcode, mở target của ứng dụng, vào **Signing & Capabilities**, bật **Automatically manage signing** nếu phù hợp và chọn đúng **Team**. Kiểm tra lại `Bundle Identifier`, `Version` (ví dụ `1.0.0`), `Build` (ví dụ `1`), deployment target, icon, quyền truy cập camera/ảnh/vị trí và mô tả lý do xin quyền trong `Info.plist` khi cần.

Trên [App Store Connect](https://appstoreconnect.apple.com/), tạo **New App** để khai báo tên, nền tảng, ngôn ngữ chính, Bundle ID và SKU. Nên làm trước khi upload để dễ đối chiếu định danh. Tên app và bundle ID không phải một thứ.

## 4. Thao tác trong Xcode: Archive → Upload build

Với **ứng dụng Swift/SwiftUI đã chạy được**, đường đi thủ công phổ biến:

1. **Mở project/workspace** bằng Xcode trên macOS. Cài dependencies và kiểm tra build Release không có lỗi.
2. **Chọn đích build cho thiết bị iOS** (thường là `Any iOS Device (arm64)` hoặc đích thiết bị tổng quát tương ứng trong Xcode), không chọn một simulator để làm bản phân phối App Store.
3. Chọn menu **Product → Archive**. Đợi Xcode build bản archive.
4. Trong **Organizer → Archives**, chọn archive vừa tạo, nhấn **Distribute App** và chọn con đường **App Store Connect** tương ứng phiên bản Xcode.
5. Làm theo trình hướng dẫn signing/validation, chọn **Upload**. Giải quyết các cảnh báo nếu có rồi gửi.
6. Mở **App Store Connect → ứng dụng → TestFlight / Builds** và chờ Apple xử lý. Khi build đã được xử lý, bạn mới có thể chọn nó để test hoặc nộp duyệt.

Đối với build mới, **tăng Build Number** theo quy tắc của Apple; khi phát hành phiên bản mới, cập nhật Version Number cho phù hợp. Bundle ID không nên đổi tùy tiện sau khi tạo app record.

### Nếu bạn thích build bằng dòng lệnh

Ví dụ tham khảo cho dự án Xcode có `scheme` tên `HabitFlow` (điều chỉnh theo project thật):

```bash
xcodebuild \
  -project HabitFlow.xcodeproj \
  -scheme HabitFlow \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/HabitFlow.xcarchive \
  archive
```

Sau bước này, bạn có thể upload archive bằng Xcode hoặc dùng `xcodebuild -exportArchive` với `ExportOptions.plist` phù hợp để xuất gói, rồi upload bằng công cụ được Apple hỗ trợ. **Đừng copy lệnh và đoán signing:** Team ID, scheme, certificate, capability và phương thức phân phối phải khớp dự án.

Tài liệu tham khảo: [Distributing your app for beta testing and releases](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases/) và [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/).

## 5. TestFlight: thử thật trước khi đưa người dùng lên App Store

**TestFlight** giúp gửi app beta đến iPhone của tester, nhận phản hồi và phát hiện lỗi mà simulator có thể bỏ sót. Quy trình nên thử: đăng nhập, tạo dữ liệu, đóng/mở lại app, tắt mạng, nâng phiên bản, kiểm tra lỗi quyền truy cập và lưu dữ liệu.

Hãy phân biệt hai cửa:

| Mục đích | Ai dùng? | Có thay App Review chính thức không? |
| --- | --- | --- |
| Internal TestFlight | Người trong nhóm App Store Connect có vai trò phù hợp | Không |
| External TestFlight | Tester ngoài nhóm, qua lời mời/link beta; build có thể cần beta review | Không |
| App Review | Apple kiểm tra bản chính thức và metadata để phát hành | Đây mới là xét duyệt phát hành |

Bạn không cần tung beta công khai ngay. Một nhóm nhỏ tester đủ đa dạng thiết bị và phiên bản iOS có thể giúp tìm lỗi trước khi gửi Apple. Không có bảo đảm cố định về thời gian xét duyệt TestFlight hay App Store.

## 6. App Store Connect: hoàn thiện hồ sơ trước khi Submit

Hãy hình dung App Store Connect như bộ hồ sơ sản phẩm, **không phải chỗ lưu source code**. Các trường quan trọng thường gồm tên và phụ đề app, mô tả, từ khóa, phân loại, độ tuổi, ngôn ngữ, màn hình screenshot đúng kích thước được hỗ trợ, icon, URL hỗ trợ, **Privacy Policy URL** khi áp dụng, khai báo **App Privacy**, export compliance và phương án phát hành.

| Điều Apple cần thấy | Kiểm tra trước khi nộp |
| --- | --- |
| App hoạt động | Không crash, không màn hình trắng, không nút giả |
| Đăng nhập | Có tài khoản demo hoặc chỉ dẫn truy cập tính năng cần login cho reviewer |
| Quyền riêng tư | Khai báo dữ liệu thu thập/SDK chính xác; giải thích mục đích xin quyền |
| Nội dung và thanh toán | Nội dung hợp pháp; xem kỹ quy định In-App Purchase với hàng hóa số và các ngoại lệ áp dụng |
| Ảnh chụp | Screenshot phản ánh **ứng dụng thật**, không phải mockup gây hiểu lầm |
| Người dùng | Link hỗ trợ hoạt động; nếu tạo tài khoản, kiểm tra yêu cầu xóa tài khoản trong app |
| Bản build | Chọn đúng Version và build đã được Apple xử lý |

Ví dụ: ứng dụng quản lý thói quen chỉ lưu dữ liệu **trên iPhone** có bề mặt quyền riêng tư khác với ứng dụng gửi email, ghi chú hoặc lịch sử sử dụng đến backend của bạn. Không được tự khai “không thu thập dữ liệu” khi SDK phân tích, crash reporting hoặc hệ thống của bạn thực tế có thu thập dữ liệu thuộc phạm vi phải khai báo.

**Đừng upload dữ liệu thực của khách hàng làm dữ liệu demo cho Apple.** Cung cấp tài khoản thử nghiệm và dữ liệu giả an toàn, đủ để reviewer đi hết các chức năng chính. Nếu một tính năng yêu cầu trả phí, thiết bị đặc biệt hoặc tài khoản đăng nhập, giải thích rõ cách thử trong phần Review Notes.

## 7. Submit for Review → Apple quyết định → phát hành

Khi build đã sẵn sàng, chọn build cho phiên bản iOS đang chuẩn bị trong App Store Connect, hoàn tất các mục bắt buộc, thêm vào submission nếu giao diện yêu cầu, rồi **Submit for Review**. Tên nút và các màn hình có thể thay đổi theo App Store Connect.

Đây là nhánh quyết định:

- **Approved:** ứng dụng được chấp thuận. Nó lên store theo cấu hình release bạn chọn: tự động, thủ công hoặc lịch phát hành phù hợp. *Được duyệt không có nghĩa luôn xuất hiện ngay tức khắc.*
- **Rejected / Metadata Rejected:** đọc thông báo và guideline được dẫn, trả lời reviewer khi cần; sửa metadata hoặc mã nguồn; nếu sửa app thì tăng build, archive/upload build mới và gửi lại.
- **Waiting for Review / In Review:** chỉ là trạng thái xử lý, **không phải chứng nhận đã được Apple chấp thuận**.

Nếu bị từ chối, đừng đoán nguyên nhân. Mở **Resolution Center / App Review messages** trong App Store Connect, xem chức năng cụ thể và minh chứng. Sau đó ghi lại lỗi, commit sửa ở GitHub, test lại bản build đúng SHA/version rồi nộp lại. Một lần bị từ chối không đồng nghĩa app không thể phát hành.

Sau khi app lên store, phát hành không kết thúc: theo dõi crash, phản hồi, retention, lỗi thanh toán và quy trình cập nhật version mới. Dùng App Store Connect để kiểm tra trạng thái thật thay vì suy ra từ CI đã xanh.

## 8. Mac không đủ dung lượng cài Xcode thì đi đường nào?

Nếu laptop macOS của bạn không đủ chỗ cài Xcode, **vẫn có thể viết mã nguồn trên web, dùng VS Code, GitHub và công cụ AI**. Tuy nhiên, để build/ký/upload **ứng dụng iOS native** bạn vẫn cần môi trường Apple toolchain/Xcode trên macOS, có thể đặt ở máy khác hoặc một dịch vụ CI macOS phù hợp.

| Hướng triển khai | Phù hợp khi | Lưu ý |
| --- | --- | --- |
| Mac cục bộ + Xcode | Muốn debug và phân phối trực tiếp | Cần dung lượng cho Xcode, SDK, simulator và DerivedData |
| GitHub Actions `macos-*` | Đã cấu hình signing và muốn archive tự động | macOS runner, secrets/certificate quản lý kỹ; chi phí/quota phụ thuộc gói |
| Xcode Cloud | Dự án tương thích, dùng hệ sinh thái Apple | Thiết lập workflow, membership, signing và giới hạn sử dụng theo điều kiện Apple |
| Dịch vụ build macOS khác | Không có máy Mac phù hợp | Kiểm tra bảo mật credentials, hỗ trợ stack và chi phí trước khi chọn |

Với app định hướng **web-first rồi chuyển native** như ReleaseProof, cách ít rủi ro là tách **core logic**, API/data model và UI ra những lớp rõ ràng. Có thể giữ website chạy trên Cloudflare, rồi viết native iOS client ở giai đoạn sau. Cách này **không tự tạo ra IPA từ website** và vẫn cần kiểm tra App Review Guidelines nếu dùng WebView hay wrapper.

### Checklist trước lúc bấm Submit

- [ ] Tất cả flow chính chạy được trên **thiết bị iPhone thật** và bản Release.
- [ ] Apple Developer Program và App Store Connect có quyền cần thiết.
- [ ] Bundle ID, signing, version, build number đều khớp.
- [ ] Archive/upload thành công, build xử lý xong trên App Store Connect.
- [ ] App icon và screenshot là sản phẩm thật, đúng yêu cầu.
- [ ] Privacy labels, policy, quyền truy cập, age rating và thông tin tuân thủ đã chính xác.
- [ ] Tài khoản reviewer và hướng dẫn thử nghiệm hoạt động (nếu có login).
- [ ] Đã thử TestFlight hoặc có quy trình QA tương đương đủ tin cậy.
- [ ] Chọn đúng release option và **Submit for Review**.
- [ ] Có kế hoạch trả lời App Review, sửa lỗi và theo dõi sau phát hành.

### Tài liệu gốc của Apple (kiểm tra ngày 22/11/2026)

1. [Apple Developer Program — Membership](https://developer.apple.com/programs/whats-included/) — tư cách thành viên, chi phí.
2. [Distributing your app for beta testing and releases](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases/) — archive và phân phối qua Xcode.
3. [Add a new app](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app) — tạo hồ sơ ứng dụng.
4. [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/) — tải bản build.
5. [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/) — beta testing.
6. [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy) — quyền riêng tư.
7. [Submit an app](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app) — gửi Apple duyệt.
8. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — tiêu chí xét duyệt.
9. [Xcode Cloud](https://developer.apple.com/documentation/xcode/xcode-cloud) — build, test và archive trên cloud.

**Kết luận:** từ GitHub đến App Store không phải một cú nhấp “đóng gói IPA”. Quy trình đúng là **build → ký số → archive → upload → test/hoàn thiện hồ sơ → submit → Apple review → release**. Giữ từng bước có bằng chứng và bạn sẽ biết chính xác ứng dụng đang ở đâu, thay vì chỉ thấy “upload thành công” rồi tưởng đã xuất bản.

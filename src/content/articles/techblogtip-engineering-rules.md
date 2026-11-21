---
title: "TechBlogTip Engineering Rules: 11 nguyên tắc để blog phát hành có kiểm chứng"
description: "Giải phẫu 11 quy tắc kỹ thuật của TechBlogTip: Draft PR, exact SHA, GitHub Pages, bảo mật, WebP và cách giữ chuỗi xuất bản minh bạch."
published: "2026-11-21"
category: "Engineering"
author: "Duy Nguyen | Engineering team"
tags: ["Engineering", "GitHub Actions", "Astro", "CI/CD", "GitHub Pages", "Exact SHA", "Security"]
series: "Hậu trường TechBlogTip"
sourceType: "manual"
draft: false
---

> Một blog kỹ thuật không chỉ cần chạy nhanh. Nó cần trả lời được ba câu hỏi khó hơn: **Ai thay đổi mã nguồn? Phiên bản nào đã được kiểm thử? Và người đọc thực sự đang xem phiên bản nào?** File [AGENTS.md của TechBlogTip](https://github.com/duykhang68/techblogtip/blob/main/AGENTS.md) là bản giao ước giúp mỗi lần phát triển giữ nguyên những câu trả lời ấy.

## 01. Vì sao một blog nhỏ lại cần engineering rules?

Blog cá nhân thường bắt đầu đơn giản: sửa bài, chạy build và đưa lên mạng. Nhưng khi có Astro, Google Sheets Publisher, Cloudflare Workers, GitHub Actions và GitHub Pages, số đường đi của một thay đổi tăng lên. Người viết có thể sửa nội dung trên Sheet trong khi developer chỉnh giao diện và workflow triển khai đang xử lý một commit khác.

Đó là lúc nguyên tắc quan trọng hơn trí nhớ. **Engineering rules không thay thế code review**; chúng đặt các giới hạn dễ kiểm tra để giảm cơ hội biến một thao tác tiện tay thành sự cố production.

Trong TechBlogTip, văn bản trung tâm là [AGENTS.md](https://github.com/duykhang68/techblogtip/blob/main/AGENTS.md). Phiên bản dùng làm nguồn cho bài viết này chứa 11 quy tắc nền tảng, từ phạm vi repository đến điều kiện ghi nhận xuất bản. Đây là **chính sách thiết kế**; việc mỗi luồng đã tuân thủ đầy đủ đến đâu vẫn cần kiểm thử và bằng chứng thực tế.

## 02. Ranh giới đầu tiên: chỉ một repository

Quy tắc mở đầu nói rõ phạm vi là `duykhang68/techblogtip`. Không lấy content, secrets, Worker, domain hay Sheet ID của OneBlog dùng lại. Nghe như một dòng tài liệu nhỏ, nhưng nó chặn một lớp lỗi rất thực tế: cấu hình đúng cú pháp nhưng **trỏ nhầm hệ thống**.

Mỗi môi trường cần biết rõ tài nguyên nào thuộc quyền sở hữu của mình. Tái sử dụng *mẫu kiến trúc* là tốt; tái sử dụng *thông tin định danh và bí mật* giữa hai dự án là rủi ro.

## 03. Draft PR là cửa vào bắt buộc

Mọi thay đổi mã nguồn, cấu hình và workflow đều đi qua **Draft Pull Request**. Chỉ README.md và AGENTS.md có ngoại lệ direct commit khi được yêu cầu rõ ràng. Draft không có nghĩa là chất lượng kém; nó có nghĩa là thay đổi **chưa được tuyên bố sẵn sàng**.

Một quy trình an toàn nên diễn ra theo thứ tự: tạo nhánh → Draft PR → kiểm thử → review → Ready → merge. Quy tắc thứ ba bổ sung ranh giới cứng: **không merge Draft PR, không bỏ qua quality gate và không tuyên bố đã deploy chỉ vì CI xanh**.

Đây cũng là lý do không nên coi một nút bấm “Publish” như quyền vượt qua review.

## 04. Exact SHA: kết quả kiểm thử phải thuộc đúng commit

Một workflow xanh vào buổi sáng có thể không còn nói gì về commit được đẩy vào buổi chiều. TechBlogTip yêu cầu deployment xuất phát từ `main` đã được kiểm định, đi qua GitHub Actions theo chuỗi tuần tự, và SHA trong `/release.json` của trang public phải bằng SHA được triển khai.

Có ba mã định danh cần phân biệt:

| Dấu mốc | Câu hỏi nó trả lời |
| --- | --- |
| PR head SHA | CI đã kiểm tra phiên bản mã nguồn nào? |
| Main / deployment SHA | Phiên bản nào được chọn làm bản phát hành? |
| Public release SHA | Site người dùng đang truy cập tự khai báo phiên bản nào? |

**CI green ≠ production verified.** Quy trình chỉ thực sự đóng lại khi có bằng chứng từ trang public. Bài [hành trình Google Sheets Publisher](/techblogtip/bai-viet/hanh-trinh-xay-dung-google-sheets-publisher-techblogtip/) giải thích sâu hơn lớp xác minh này.

## 05. Staging phải là staging, không phải một bản production thứ hai

Môi trường thử nghiệm bắt buộc mang `noindex`. Điều đó giúp tránh các URL preview bị công cụ tìm kiếm hiểu là nguồn nội dung chính thức. Production phải có canonical hợp lệ và đường dẫn đúng.

TechBlogTip sử dụng đường dẫn dự án `/techblogtip/` trên GitHub Pages, nên một URL tuyệt đối hoặc liên kết thiếu base path có thể phá navigation dù build vẫn thành công. **Không thay đổi URL công khai khi chưa có redirect** cũng là một phần của hợp đồng.

Đằng sau một liên kết đơn giản là nguyên tắc: định danh nội dung cần bền vững hơn cách triển khai hiện tại.

## 06. Static-first: trình duyệt không cần GitHub API

Trang blog tĩnh phải không gọi GitHub API từ phía client. Chỉ mục tìm kiếm được sinh khi build. Điều này giảm phụ thuộc vào API rate limit, giữ token ra khỏi trình duyệt và giúp trang đọc được kể cả khi API bên ngoài gặp sự cố.

Kiến trúc này không cấm mọi JavaScript: tìm kiếm giao diện, mục lục thông minh hoặc tính năng tương tác nhỏ vẫn có thể chạy tại client. Điểm khác biệt là **dữ liệu xuất bản không cần truy vấn GitHub API mỗi khi có một người đọc**.

## 07. WebP và mô tả ảnh là tiêu chuẩn biên tập

Ảnh nội dung phải dùng WebP kèm alt mô tả. Không hotlink ảnh từ Google Drive, không đưa JPG/PNG vào tài sản bài viết. Khi bài có nhiều infographic, chất lượng không chỉ nằm ở màu sắc mà còn ở khả năng truy cập.

Bài viết cần đi cùng hình có ý nghĩa: sơ đồ luồng, bảng đối chiếu, thẻ trạng thái hoặc timeline. Hình minh họa không nên chỉ làm đẹp; nó phải giúp người đọc hiểu điều gì thay đổi, vì sao có chốt kiểm tra và bước tiếp theo là gì.

## 08. Secret không bao giờ là content

OAuth credentials, GitHub tokens, service account keys và API secrets không được xuất hiện trong repository. Không nên đưa secret vào frontmatter, screenshot, log công khai hoặc liên kết minh họa.

Trước khi đề xuất một chức năng mới, câu hỏi cần trả lời là: **điều gì chạy ở browser, điều gì chạy ở Worker và ai có quyền thực hiện hành động ghi?** Nếu không vẽ được ranh giới này, giao diện đẹp cũng chưa đủ để an toàn.

## 09. Tối ưu workflow bằng sự kiện, không bằng nhịp đồng hồ

AGENTS.md yêu cầu hạn chế GitHub Actions và Cloudflare operations: không polling, không cron cho các hoạt động giao hàng bình thường, không gọi API dư thừa. Thay vì mỗi vài phút hỏi “đã xong chưa?”, hệ thống nên phản ứng khi có thay đổi trạng thái đủ quan trọng.

Đây là một bài toán hiệu năng **của hệ thống vận hành**, chứ không chỉ điểm Lighthouse. CI chạy vô ích cũng tiêu tốn tài nguyên và tạo nhiễu cho người đang điều tra lỗi.

## 10. Tích hợp bên ngoài không được tự ý sửa production

Notion, Obsidian và Google Sheets được xác định là các integration theo milestone; chúng không được tự ý mutate nội dung đang live. Ngay cả khi người viết sử dụng Google Sheets như bàn biên tập, việc chuyển từ dữ liệu nhập sang release vẫn phải đi qua những cổng kiểm soát của GitHub.

Tách quyền *soạn thảo* khỏi quyền *phát hành* chính là chìa khóa để hệ thống dễ mở rộng mà không đánh đổi khả năng rollback và truy vết.

## 11. Quy tắc mới cho trải nghiệm đọc và visual

Bên cạnh 11 nguyên tắc nền tảng, lớp trình bày cần một tiêu chuẩn vận hành tương đương: đoạn văn canh đều tự nhiên ở màn hình đủ rộng, **không bẻ chữ tiếng Việt hoặc kéo giãn khoảng trắng bất thường**; tiêu đề tận dụng bề ngang và ngắt dòng cân đối. Trên màn hình rất hẹp, canh trái có thể tốt hơn việc ép justify.

Ở phần visual, bài viết nên có ít nhất một **bản đồ nội dung tự sinh** từ các heading, bên cạnh infographic chuyên đề khi cần. Điều này làm cho visual không còn phụ thuộc vào việc tác giả có nhớ yêu cầu một thiết kế riêng hay không.

Đây là định hướng cải tiến trong bài viết và PR đi kèm, **không phải một mục có sẵn trong 11 dòng AGENTS.md trên main tại thời điểm khảo sát**.

## 12. Khi nào mới được nói “đã lên production”?

Hãy tưởng tượng một commit đổi CSS và thêm bài viết. Draft PR được tạo, quality workflow hoàn tất, nhưng public `/release.json` vẫn trỏ tới commit cũ. Trong trường hợp đó, nói “đã deploy” là sai: chúng ta mới có **một ứng viên phát hành**, chưa có bằng chứng production.

Ngược lại, khi PR được duyệt và merge đúng gate, `main` được triển khai tuần tự, URL public truy cập được và release marker khớp với commit đã phát hành, chuỗi bằng chứng mới khép lại.

Engineering rules biến câu “chắc là ổn” thành một chuỗi kiểm tra: **đúng repo → đúng PR → đúng SHA → đúng public**.

## 13. Kết luận: thiết kế cho sự tin cậy

Điều đáng giá nhất của TechBlogTip engineering rules không phải là 11 gạch đầu dòng. Đó là quyết định **để hệ thống chịu trách nhiệm giải thích trạng thái của chính nó**: tài nguyên thuộc dự án nào, ai được phép thay đổi, bản build kiểm tra commit gì và production đang phục vụ phiên bản nào.

Một blog tốt giúp độc giả hiểu công nghệ. Một hệ thống xuất bản tốt còn giúp người viết tin được vào từng lần bấm nút.

---

**Nguồn kỹ thuật:** [AGENTS.md](https://github.com/duykhang68/techblogtip/blob/main/AGENTS.md) · [Quality workflow](https://github.com/duykhang68/techblogtip/blob/main/.github/workflows/quality.yml) · [Production workflow](https://github.com/duykhang68/techblogtip/blob/main/.github/workflows/deploy-production.yml) · [Repository](https://github.com/duykhang68/techblogtip).

*Bài viết diễn giải các quy tắc hiện có; phần visual/typography được trình bày riêng như hướng nâng cấp, không coi là tính năng production đã nghiệm thu.*

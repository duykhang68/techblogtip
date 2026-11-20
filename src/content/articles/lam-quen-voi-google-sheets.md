---
title: "Làm quen với Google Sheets và các hàm thông dụng"
description: "Học cách tổ chức một bảng tính rõ ràng, sử dụng SUM, IF, COUNTIF và tránh những lỗi nhập liệu thường gặp."
published: 2026-11-20
category: "Tin học văn phòng"
author: TechBlogTip
tags: ["Google Sheets","Spreadsheet","Hàm"]
series: "Google Sheets căn bản"
draft: false
---

> **Bài mẫu Milestone A:** Nội dung minh họa cho giao diện và quy trình kiểm thử. Sẽ được biên tập/duyệt trước khi ra mắt SEO.

## Bắt đầu từ bảng dữ liệu sạch
Mỗi cột nên có một tiêu đề rõ ràng, mỗi hàng biểu diễn một bản ghi. Không trộn nhiều loại dữ liệu trong cùng một cột nếu sau này cần lọc hoặc tính toán.
## Ba hàm nên biết
- `SUM(A2:A10)` tính tổng dãy ô số.
- `IF(B2>0,"Có","Không")` trả về một trong hai giá trị theo điều kiện.
- `COUNTIF(C2:C100,"Đã xong")` đếm các ô khớp điều kiện.
Tên hàm và dấu phân tách đối số có thể thay đổi tùy theo thiết lập ngôn ngữ và khu vực của bảng tính.
## Tổ chức dữ liệu để tự động hóa
Giữ một cột ID ổn định, tránh dùng số thứ tự hàng làm mã định danh duy nhất. Nhờ vậy, khi sắp xếp lại bảng, dữ liệu vẫn có thể được đối chiếu đúng.
## Kiểm tra trước khi chia sẻ
Xem lại quyền truy cập của tệp và chỉ cấp quyền chỉnh sửa cho người thực sự cần.

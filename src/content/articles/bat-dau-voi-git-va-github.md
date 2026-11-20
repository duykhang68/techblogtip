---
title: "Bắt đầu với Git và GitHub cho người mới"
description: "Những khái niệm Git cơ bản, cách tạo repository, lưu thay đổi và gửi Pull Request để cộng tác an toàn."
published: 2026-11-20
category: "Lập trình & GitHub"
author: TechBlogTip
tags: ["Git","GitHub","Repository"]
series: "Git từ cơ bản"
draft: false
---

> **Bài mẫu Milestone A:** Nội dung minh họa cho giao diện và quy trình kiểm thử. Sẽ được biên tập/duyệt trước khi ra mắt SEO.

## Git và GitHub khác nhau thế nào?
Git là hệ thống quản lý phiên bản chạy trên máy của bạn. GitHub là dịch vụ lưu trữ repository Git và cung cấp công cụ cộng tác như Issues, Pull Requests và Actions. Bạn có thể dùng Git hoàn toàn trên máy tính mà không cần GitHub.
## Quy trình thực hành đầu tiên
1. Tạo một thư mục dự án và khởi tạo Git bằng lệnh `git init`.
2. Tạo tệp README để mô tả dự án, sau đó kiểm tra các thay đổi với `git status`.
3. Lưu thay đổi bằng `git add README.md` và `git commit -m "docs: add README"`.
4. Tạo repository trên GitHub, thêm remote và đẩy branch theo hướng dẫn hiển thị trên GitHub.
## Khi nào nên dùng Pull Request?
Dùng Pull Request để thảo luận thay đổi và chạy kiểm thử trước khi đưa vào nhánh chính. Đối với nội dung website, đây cũng là một điểm kiểm duyệt hiệu quả.
## Ghi nhớ
Đừng đưa mật khẩu, token hoặc khóa bí mật vào repository. Bật xác thực hai yếu tố cho tài khoản GitHub và dùng secret storage cho pipeline triển khai.

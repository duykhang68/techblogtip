---
title: "Kiểm thử quy trình Google Sheets đến GitHub Draft PR"
description: "Bài thử nghiệm nội bộ để xác minh luồng READY, tạo một GitHub Draft PR và ghi ngược K:L mà không xuất bản."
published: "2026-11-20"
category: "Kiểm thử hệ thống"
author: "TechBlogTip"
tags: ["Publisher","Google Sheets","E2E"]
sourceType: "google-sheets"
sourceId: "TBT-ed3fa834-d43c-4852-ad7b-1128cd4486c0"
sourceRevision: "e5a47b46040529ff8698120a23dd8ded6b5f1bcdbad51aecd1de7b140971e3ac"
draft: false
---

## Mục tiêu
Bài kiểm thử nội bộ nhằm xác minh TechBlogTip Publisher đọc dữ liệu từ Google Sheets, kiểm tra nội dung và mở chính xác một Draft Pull Request trên GitHub.

## Tiêu chí kiểm thử
Khi người biên tập chủ động duyệt READY và nhấn Tạo Draft PR, hệ thống cần ghi dấu vân tay nguồn vào cột K, liên kết Draft PR vào cột L và giữ trống các cột M đến O.

## Lưu ý
Đây là nội dung kiểm thử E2E; không merge PR hoặc công bố bài lên production. Hãy đóng PR thử nghiệm sau khi xác nhận xong.

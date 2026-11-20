# Publisher · Thanh tiến độ xuất bản trong Editorial Studio

Thanh tiến độ **6 bước** xuất hiện ngay trên thẻ mỗi bài trong hàng đợi và trong
khung **Sửa trực quan** của các bài được phép biên tập. Giao diện responsive,
màu pastel, sử dụng thẻ `<progress>` và nhãn từng bước dễ đọc trên mobile.

| Bước | Điều kiện xác minh |
| --- | --- |
| Bản nháp | Có nội dung/tiêu đề trong Google Sheets `VN` |
| READY | Biên tập viên đã chuyển trạng thái READY, hoặc bài đã ghi K:L |
| Draft PR | Cột K có fingerprint và L có URL PR đúng repository |
| CI đạt | Worker trả checks cho **đúng PR head SHA**, Quality có mặt và toàn bộ checks hoàn tất `success` (không tính unavailable/partial) |
| Đã merge | Worker xác nhận PR thực sự merged |
| Lên blog | Chỉ khi Worker xác minh production, đồng thời M:O có URL, SHA, thời gian hợp lệ |

**Lấy trạng thái:** tải Google Sheets qua `/api/rows`, sau đó nhấn
**Cập nhật tiến độ** để dùng `/api/pr-status?sourceId=...` (qua Worker).
Không polling, cron, client-side GitHub API hoặc tự động merge/publish.
Cache ở RAM được xóa khi logout và không tái sử dụng nếu fingerprint/PR URL đổi.

**Các tình huống ngoại lệ:** CI thất bại và PR đóng không merge được hiển thị
rõ ràng. Nếu thiếu quyền đọc Checks thì không coi CI là PASS. Trạng thái Sheet
`PUBLISHED` hoặc chỉ có metadata M:O **không chứng minh** production đã lên.
Ngay cả PR merged cũng chỉ hiện **Chờ xác minh production**.

**Giới hạn hiện tại:** P5c.3 (release writeback M:O và xác minh public URL,
exact release SHA) vẫn là giai đoạn chưa triển khai. Backend hiện trả
`productionVerified: false`; bước cuối sẽ để chờ đến khi có chứng cứ thật.
Không được tự đánh dấu 100%. Các API writer/Google Sheets source không đổi.

**Triển khai:** sau khi PR vượt Quality, Security và Publisher Worker bundle
theo exact SHA, merge theo FIFO. Chạy workflow Publisher DEV manual trên main
với `deploy-dev-only`, kiểm tra `/health` SHA. Cloudflare staging không dùng
để triển khai giao diện Admin Publisher.

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

## Production Status — snapshot repository và hàng đợi PR trong Editorial Studio

Ở **cuối trang Editorial Studio**, section phụ **Production Status** hiển thị
snapshot chỉ đọc theo yêu cầu của biên tập viên đã đăng nhập Google.

**Cơ chế dữ liệu**
- Nhấn **Lấy snapshot mới** gọi Worker `/api/production-status` (GET).
- Worker lấy ref `main`, danh sách PR đang mở theo thời gian tạo (FIFO presentation),
  và kiểm tra hai marker public:
  staging `/release.json` và Publisher DEV `/health`.
- Toàn bộ GitHub API và token nằm **trên Worker**, trình duyệt chỉ gọi
  cùng origin. Không có cron, polling, push hook hoặc tự động phát hành.
- Snapshot không được cache hoặc lưu vào localStorage; logout xóa dữ liệu UI.
- Không tải danh sách GitHub Actions gần nhất; trạng thái CI của từng bài vẫn
  được xác minh qua chức năng **Cập nhật tiến độ** trên thẻ bài.

**Phân biệt môi trường**
- `MAIN`: commit ref hiện tại, không phải release.
- `STAGING`: SHA marker tại public `/release.json`. Chỉ được ghi là
  **staging** ngay cả khi trùng main. Staging có `noindex`.
- `PUBLISHER DEV`: SHA và Durable Object binding được báo bởi `/health`;
  Worker admin không phải public blog production.
- `PRODUCTION`: chưa có public production URL, exact SHA + verification gate;
  vì thế section hiển thị **Chưa xác minh**, tuyệt đối không báo thành công.

Snapshot chỉ phục vụ quan sát tình hình repository. **Không tự merge PR,
không triển khai code và không sửa Google Sheets**.

Khung được đặt sau editor, giao diện responsive. Nội dung từ GitHub được đưa
vào DOM bằng `textContent`, đường dẫn được tạo/kiểm tra theo repository cố định.

## Xóa bài khỏi Hàng đợi bài viết

Bài chưa tạo PR/chưa xuất bản (IDEA, DRAFT, REVIEW hoặc READY) có nút **Xóa bài**.
Người dùng xác nhận bằng hộp thoại có tên bài và nút hủy; Worker xác minh
session, same-origin, bản chụp SHA-256 của hàng và quyền xóa trước khi ghi.
Worker xóa toàn bộ ô A:O của hàng trong Sheet VN, không chỉ ẩn khỏi UI.
Hàng vật lý được giữ trống để tránh dịch chuyển số hàng đang được các thao tác
biên tập/xuất bản khác sử dụng. Bài có dữ liệu K:O hoặc đã PUBLISHED không thể
xóa tại đây. Mỗi lần xóa được khóa theo source ID hoặc số hàng và xác minh
Google Sheets không còn dữ liệu sau khi xóa.

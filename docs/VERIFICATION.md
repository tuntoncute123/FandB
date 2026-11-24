# Kiểm chứng thực tế — 16/11/2026

Ứng dụng được kiểm chứng tại môi trường Node.js 24.22.1, Chromium / Playwright, build production Vite. Chưa publish/deploy.

## Kết quả

- `npm run build`: đạt; bundle JavaScript khoảng 348 KB, gzip khoảng 103 KB.
- `npm test`: **24/24** kiểm thử đạt.
- `npm run test:ui`: **10 luồng nghiệp vụ qua giao diện** đạt; không phát sinh lỗi JavaScript.
- **72 tổ hợp màn hình/viewport**: 12 màn hình × 6 viewport; không có tràn ngang toàn trang. Bảng dữ liệu có vùng cuộn ngang riêng trên điện thoại.
- axe WCAG 2 A/AA trên 12 màn hình ở 1366px: **0 vi phạm được công cụ phát hiện**. Kết quả này không thay thế đánh giá khả năng truy cập thủ công toàn diện.
- `npm run test:zoom`: Chromium **200% thật**, cửa sổ 1366px chuyển thành viewport 683 CSS px; không tràn trang; tạo đơn, dialog, focus bàn phím và Escape hoạt động.
- `npm run backup`: tạo được file sao lưu SQLite nhất quán khi máy chủ đang chạy.
- `npm audit`: 0 lỗ hổng được báo cáo tại thời điểm kiểm tra.

## Typography thực đo

Cỡ chữ lấy bằng `getComputedStyle`, zoom trình duyệt 100%, deviceScaleFactor 1. Đã chụp và xem ảnh tại các viewport bên dưới.

| Viewport CSS | H1 | Body | Menu | Nút chính | Nội dung thẻ món |
| --- | ---: | ---: | ---: | ---: | ---: |
| 360 px | 23 px | 16 px | 14 px | 14 px | 14 px |
| 390 px | 23 px | 16 px | 14 px | 14 px | 14 px |
| 768 px | 24 px | 16 px | 14 px | 14 px | 14 px |
| 1366 px | 28,29 px | 16,27 px | 14 px | 14,09 px | 14 px |
| 1920 px | 33,28 px | 18 px | 15,46 px | 15,58 px | 15,46 px |
| 2560 px | 39,04 px | 20 px | 17,25 px | 17,31 px | 17,25 px |

Thẻ món được đo trên nội dung bảng món bán chạy. POS và thực đơn dùng token tiêu đề thẻ riêng. Các vai trò chữ đều tăng từ 1366 → 1920 → 2560; không bị khóa ở kích thước laptop. Biểu đồ dùng ResizeObserver để điều chỉnh hệ tọa độ theo chiều rộng thật, giúp nhãn trục không co thành chữ rất nhỏ trên điện thoại.

## Luồng thao tác đã chạy qua giao diện

1. Tạo, tìm và sửa khách hàng.
2. Chọn khách, thêm món, giảm giá, gửi bếp, chuyển chế biến/sẵn sàng, thu tiền mặt, kiểm tra tiền thừa, in phiếu và tải lại trang.
3. Thêm bàn, đặt trước, mở POS cho đúng bàn.
4. Sửa giá món và xác nhận thay đổi áp dụng tại chi nhánh khác.
5. Điều chuyển nguyên liệu, kiểm tra tổng tồn hai chi nhánh được bảo toàn.
6. Chuyển chi nhánh và xác nhận không hiển thị đơn của chi nhánh cũ.
7. Tải báo cáo CSV có dữ liệu thật.
8. Tạo thu ngân tại chi nhánh 2, đăng nhập bằng tài khoản đó và kiểm tra menu/phạm vi chi nhánh.
9. Lưu thông tin phiếu bán hàng.
10. Mở chi nhánh mới, xác nhận bàn rỗng và mọi tồn kho bằng 0.

API được kiểm tra thêm: không đủ kho thì rollback, không trả tiền hai lần, không lặp đơn khi gửi lại, không truy cập chéo chi nhánh, không sửa quyền của chính quản trị viên, khóa nhân viên thu hồi phiên, thuế/giá lịch sử không thay đổi, hủy đơn hoàn đúng công thức đã xuất.

## Bằng chứng và chạy lại

- `test-results/results.json`: kết quả nghiệp vụ, typography, overflow, axe.
- `test-results/dashboard-{360,390,768,1366,1920,2560}.png`: ảnh tổng quan.
- `test-results/{pos,branches,menu}-{390,1366,2560}.png`: ảnh các màn hình bổ sung.
- `test-results/zoom.json`, `zoom-200-dashboard.png`, `zoom-200-dialog.png`: zoom thật 200%.
- `test-results/report.csv`: báo cáo tải qua giao diện.

Thư mục `test-results/` không đưa vào Git theo mặc định. Test sử dụng database tạm, độc lập với `data/la-fnb.sqlite`. Trong môi trường kiểm chứng này, các thư viện Linux cho Chromium được cung cấp qua `LD_LIBRARY_PATH=/tmp/maison-browser-libs/usr/lib/x86_64-linux-gnu`.

## Giới hạn đã xác định

Chưa thử máy in nhiệt vật lý, cổng thanh toán hoặc hóa đơn điện tử vì chưa có tích hợp đó. Chưa thử tải đồng thời quy mô chuỗi lớn, trình duyệt Safari/Firefox và thiết bị di động vật lý. Bản hiện tại dùng một máy chủ SQLite; giao dịch ngoài hệ thống được ghi nhận thủ công. Danh sách chức năng và phạm vi tích hợp đầy đủ nằm trong README.

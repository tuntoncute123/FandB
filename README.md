# Lá F&B — Quản lý chuỗi nhà hàng & cà phê

Ứng dụng web tiếng Việt có giao diện React, máy chủ Express và dữ liệu SQLite được lưu thật. Quản trị viên quản lý tập trung toàn chuỗi; thu ngân và nhân viên bếp chỉ truy cập chi nhánh được phân công.

## Chạy dự án

Yêu cầu **Node.js 24+** và npm.

```bash
npm install
npm run dev
```

Mở **http://localhost:5173**. Máy chủ API chạy tại cổng 3001. Lần chạy đầu tự khởi tạo dữ liệu mẫu: 3 chi nhánh, 15 món, 28 bàn, 12 nguyên liệu, 5 khách hàng, 3 tài khoản và 14 ngày doanh thu minh họa.

| Vai trò | Email | Mật khẩu mẫu | Phạm vi |
| --- | --- | --- | --- |
| Quản trị viên | `admin@lafnb.vn` | `LaFnb@2026` | Tất cả chi nhánh |
| Thu ngân | `cashier@lafnb.vn` | `LaFnb@2026` | Nguyễn Thị Minh Khai |
| Bếp | `kitchen@lafnb.vn` | `LaFnb@2026` | Nguyễn Thị Minh Khai |

Đây là tài khoản thử nghiệm. Cài đặt có chức năng đổi mật khẩu; quản trị viên có thể tạo, phân quyền, đặt lại mật khẩu và khóa nhân viên.

Bản production chạy tại máy của bạn:

```bash
npm run build
npm start
```

Mở **http://localhost:3001**. Dừng `npm run dev` trước nếu cổng 3001 đang được sử dụng. Các lệnh này chỉ khởi chạy máy chủ; không publish hay deploy ra dịch vụ bên ngoài.

## Chức năng đã triển khai

| Phân hệ | Chức năng |
| --- | --- |
| Tổng quan | Doanh thu hôm nay, đơn hàng, giá trị đơn, bàn đang phục vụ, biểu đồ 7/14 ngày, món bán chạy, cảnh báo kho |
| Quản lý chuỗi | Mở chi nhánh, chuyển đổi cơ sở, doanh thu hợp nhất, so sánh chi nhánh, cảnh báo kho toàn chuỗi, xuất CSV |
| Bán hàng POS | Tìm/lọc món, giỏ hàng, tăng giảm số lượng, tại bàn/mang đi/giao hàng, chọn khách, giảm giá, ghi chú, thuế, tự lưu đơn nháp riêng theo chi nhánh |
| Sơ đồ bàn | Lọc khu vực/trạng thái, thêm bàn, ghi chú đặt trước, hủy đặt trước, tạo đơn cho bàn, xem đơn đang phục vụ |
| Đơn hàng | Tìm kiếm, lọc hình thức/trạng thái, phân trang, chuyển bàn, hủy đơn, thanh toán tiền mặt/chuyển khoản/thẻ, tính tiền thừa, in phiếu, xuất CSV |
| Màn hình bếp | Các cột chờ xác nhận/đang chế biến/sẵn sàng, thời gian chờ, ghi chú món, chuyển trạng thái, tự đồng bộ mỗi 15 giây |
| Thực đơn | Tạo và sửa món, danh mục, giá bán/giá vốn, ảnh, mô tả, tạm ngưng món, công thức định lượng dùng chung toàn chuỗi |
| Kho | Tồn theo chi nhánh, nhập/xuất/hao hụt, thêm nguyên liệu, ngưỡng cảnh báo, lịch sử giao dịch, xuất CSV, điều chuyển giữa chi nhánh |
| Khách hàng | Tạo/sửa/tìm kiếm, lịch sử đơn tại chi nhánh, tổng chi tiêu và lượt ghé toàn chuỗi, tích điểm, phân hạng, xuất CSV |
| Nhân viên | Tạo/sửa tài khoản, 3 vai trò, phân công chi nhánh, khóa tài khoản, đặt lại mật khẩu |
| Báo cáo | Kỳ 7/14/30 ngày, doanh thu thực thu, lãi gộp ước tính, tổng giảm giá, cơ cấu thanh toán, hiệu quả từng món, xuất CSV |
| Cài đặt | Thông tin và phiếu bán hàng từng chi nhánh, thuế đơn mới, lời cảm ơn, đổi mật khẩu cá nhân |
| Hệ thống | Phiên đăng nhập, tìm nhanh chức năng bằng Ctrl/Cmd K, thông báo vận hành, trạng thái mất kết nối, sao lưu SQLite |

## Quy tắc dữ liệu

- **Tách chi nhánh tại API**, không chỉ lọc giao diện. Tài khoản nhân viên không thể thay header để truy cập chi nhánh khác. Quản trị viên được phép chuyển chi nhánh.
- Bàn, đơn, tồn kho, lịch sử xuất nhập và cài đặt phiếu thuộc chi nhánh. Thực đơn, công thức, nguyên liệu, khách hàng và điểm tích lũy dùng chung toàn chuỗi.
- Máy chủ tự tính giá từ thực đơn; không tin giá hay tổng tiền do trình duyệt gửi lên.
- Trừ nguyên liệu theo công thức khi tạo đơn. Nếu thiếu bất kỳ nguyên liệu nào, toàn bộ giao dịch tạo đơn bị hủy, không trừ kho một phần.
- Đơn hủy hoàn lại **đúng định lượng đã xuất**, kể cả công thức đã thay đổi sau khi tạo đơn. Với món đã làm, cần ghi nhận hao hụt trong kho để phản ánh tồn thực tế.
- Điều chuyển trừ ở chi nhánh xuất, cộng ở chi nhánh nhận và ghi hai giao dịch trong cùng một transaction. Không cho phép tồn âm.
- Luồng đơn: `Chờ xác nhận → Đang chế biến → Sẵn sàng → Đã phục vụ → Hoàn thành`. Có thể thanh toán từ bước Sẵn sàng; bếp chỉ được cập nhật chế biến và sẵn sàng.
- Đơn hoàn thành không thể thanh toán hoặc hủy lại. Thanh toán đồng thời chỉ có một giao dịch thành công.
- POS gửi mã yêu cầu duy nhất: gửi lại cùng một yêu cầu không tạo đơn và trừ kho lần hai.
- Thuế, giá bán và giá vốn được chụp lại theo đơn. Sửa thực đơn hoặc thuế không thay đổi lịch sử.
- Tự tích `floor(tổng thanh toán / 10.000)` điểm cho khách đã chọn, chỉ khi thanh toán thành công. Hạng Lá Bạc từ 100 điểm; Lá Vàng từ 200 điểm.
- Ngày báo cáo theo múi giờ Việt Nam. Biểu đồ tính doanh thu theo ngày thanh toán; giá vốn chỉ là ước tính, chưa bao gồm chi phí vận hành.
- Phiên đăng nhập 12 giờ, cookie HttpOnly/SameSite=Strict; mật khẩu băm bcrypt. Đổi mật khẩu kết thúc các phiên khác; khóa nhân viên thu hồi phiên.
- Ảnh món và font được lưu trong `public/`, không phụ thuộc CDN khi mở ứng dụng.

## Phạm vi tích hợp

Tiền mặt, chuyển khoản và thẻ hiện là **ghi nhận thanh toán thủ công**. Chưa tích hợp ngân hàng/VietQR, cổng thanh toán, máy POS thẻ, máy in nhiệt trực tiếp, hóa đơn điện tử, Grab/ShopeeFood hoặc phần mềm kế toán. In phiếu sử dụng hộp thoại in của trình duyệt; phiếu bán hàng nội bộ không thay thế hóa đơn điện tử.

Đặt bàn hiện lưu thông tin khách/giờ đến dưới dạng ghi chú. Giao hàng là loại đơn có ghi chú, chưa có quản lý tài xế. Điểm thành viên hiện dùng để tích lũy và phân hạng, chưa có đổi thưởng. Không có offline sync: đơn nháp lưu ở trình duyệt, nhưng thao tác tạo/thu tiền cần máy chủ hoạt động.

## Cấu hình và dữ liệu

Có thể sao chép `.env.example` thành `.env`:

- `PORT`: cổng API, mặc định `3001`. Nếu đổi cổng khi chạy dev, sửa target `/api` trong `vite.config.js` tương ứng.
- `DB_PATH`: đường dẫn SQLite, mặc định `data/la-fnb.sqlite`.
- `ADMIN_PASSWORD`: mật khẩu khởi tạo, chỉ áp dụng khi database hoàn toàn mới. Dữ liệu mẫu dùng mật khẩu khởi tạo này cho cả ba tài khoản.
- `COOKIE_SECURE=true`: dùng khi phục vụ ứng dụng qua HTTPS.

Dữ liệu được giữ nguyên khi tải lại trang hoặc khởi động lại máy chủ. Chạy sao lưu nhất quán kể cả khi máy chủ đang hoạt động:

```bash
npm run backup
```

File sao lưu nằm trong `data/backups/`. Khi phục hồi, dừng mọi tiến trình ứng dụng, giữ bản sao toàn bộ thư mục dữ liệu cũ, rồi sử dụng file backup ở một đường dẫn mới qua `DB_PATH`. Không chép đè file đang được SQLite mở.

## Kiểm thử

Báo cáo kết quả và cỡ chữ thực đo: [docs/VERIFICATION.md](docs/VERIFICATION.md).

```bash
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:ui
npm run test:zoom
```

- API: 24 kiểm thử, database tạm riêng, bao gồm phân quyền, cô lập chi nhánh, rollback kho, chuyển bàn, thanh toán đồng thời, idempotency, tích điểm, thuế, khóa nhân viên, phiên đăng nhập và nguồn yêu cầu.
- Trình duyệt: 10 luồng nghiệp vụ qua giao diện; kiểm tra 12 màn hình ở 360, 390, 768, 1366, 1920 và 2560 CSS px; đo cỡ chữ thật; lưu ảnh và báo cáo tại `test-results/`.
- Zoom: sử dụng API zoom thật của Chromium ở **200%**, kiểm tra tạo đơn, dialog và bàn phím. Không dùng CSS zoom hay transform scale.
- Accessibility: axe kiểm tra WCAG 2 A/AA trên các màn hình chính; kết quả cụ thể trong báo cáo kiểm chứng.
- Kiểm thử tạo database độc lập và xóa sau khi chạy; không sửa dữ liệu vận hành của bạn.

Trong môi trường Linux thiếu thư viện trình duyệt, cài phụ thuộc hệ điều hành bằng lệnh Playwright nêu trên. Nếu môi trường cung cấp thư viện ở đường dẫn riêng, có thể truyền `LD_LIBRARY_PATH` khi chạy kiểm thử.

## Cấu trúc

```text
src/
  App.jsx                 Điều hướng, khung giao diện, chi nhánh, thông báo
  store.jsx               Kết nối API, đăng nhập, dữ liệu và đồng bộ
  lib.js                  Tiền/ngày, CSV, in phiếu, mã yêu cầu
  components/             UI tái sử dụng, dialog, biểu đồ SVG responsive
  pages/                  12 phân hệ + đăng nhập, tách file riêng
  styles.css              Token typography, bố cục và responsive
server/
  db.js                   Schema, transaction, chỉ mục và dữ liệu mẫu
  index.js                API, phiên, phân quyền và nghiệp vụ
scripts/backup.mjs        Sao lưu SQLite nhất quán
tests/                    API, browser và zoom
public/images/            Ảnh minh họa món và quán
public/fonts/             Be Vietnam Pro + giấy phép OFL
```

Ảnh minh họa được tải từ Unsplash; nguồn chi tiết trong `public/images/SOURCES.md`. Font Be Vietnam Pro phát hành theo SIL Open Font License, kèm giấy phép trong thư mục font.

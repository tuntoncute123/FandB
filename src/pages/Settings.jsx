import React, { useState } from "react";
import {
  Save,
  Store,
  ReceiptText,
  LockKeyhole,
  Database,
  Check,
} from "lucide-react";
import { useApp } from "../store";
import { PageHeading, Button, Field, FormError } from "../components/ui";
export default function SettingsPage() {
  const { data, mutate } = useApp();
  const [error, setError] = useState(""),
    [passError, setPassError] = useState(""),
    [busy, setBusy] = useState(false),
    [passBusy, setPassBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.target);
    try {
      await mutate(
        "/settings",
        {
          name: f.get("name"),
          address: f.get("address"),
          phone: f.get("phone"),
          tax: Number(f.get("tax")),
          receiptNote: f.get("receiptNote"),
        },
        "PUT",
        "Đã lưu cài đặt chi nhánh.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function password(e) {
    e.preventDefault();
    const form = e.target;
    const f = new FormData(form);
    setPassBusy(true);
    setPassError("");
    if (f.get("newPassword") !== f.get("confirmPassword")) {
      setPassError("Mật khẩu xác nhận chưa khớp.");
      setPassBusy(false);
      return;
    }
    try {
      await mutate(
        "/auth/password",
        {
          currentPassword: f.get("currentPassword"),
          newPassword: f.get("newPassword"),
        },
        "PUT",
        "Đã đổi mật khẩu và kết thúc các phiên đăng nhập khác.",
      );
      form.reset();
    } catch (e) {
      setPassError(e.message);
    } finally {
      setPassBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="HỆ THỐNG"
        title="Cài đặt"
        description="Những chi tiết nhỏ tạo nên trải nghiệm riêng của Lá."
      />
      <div className="settings-layout">
        <form className="panel settings-form" onSubmit={save}>
          <div className="section-title">
            <Store size={22} />
            <div>
              <h2>Thông tin chi nhánh</h2>
              <p>{data.branches.find((b) => b.id === data.branchId)?.name}</p>
            </div>
          </div>
          <Field label="Tên thương hiệu trên phiếu bán hàng">
            <input
              name="name"
              required
              maxLength={160}
              defaultValue={data.settings.name}
            />
          </Field>
          <Field label="Địa chỉ">
            <input
              name="address"
              required
              maxLength={300}
              defaultValue={data.settings.address}
            />
          </Field>
          <Field label="Điện thoại">
            <input
              name="phone"
              required
              minLength={8}
              maxLength={20}
              defaultValue={data.settings.phone}
            />
          </Field>
          <div className="section-title separated">
            <ReceiptText size={22} />
            <div>
              <h2>Thanh toán & phiếu bán hàng</h2>
              <p>Áp dụng cho đơn mới sau khi lưu.</p>
            </div>
          </div>
          <Field
            label="Thuế (%)"
            hint="Thuế tính trên tạm tính sau giảm giá. Thiết lập theo hoạt động thực tế của cơ sở."
          >
            <input
              name="tax"
              required
              type="number"
              min="0"
              max="30"
              step="0.1"
              defaultValue={data.settings.tax}
            />
          </Field>
          <Field label="Lời cảm ơn cuối phiếu">
            <textarea
              name="receiptNote"
              maxLength={500}
              rows="3"
              defaultValue={data.settings.receiptNote}
            />
          </Field>
          <FormError error={error} />
          <div className="modal-actions">
            <Button loading={busy}>
              <Save size={17} />
              Lưu cài đặt
            </Button>
          </div>
        </form>
        <div className="settings-side">
          <form className="panel settings-form" onSubmit={password}>
            <div className="section-title">
              <LockKeyhole size={22} />
              <div>
                <h2>Bảo mật tài khoản</h2>
                <p>Đổi mật khẩu đăng nhập của bạn.</p>
              </div>
            </div>
            <Field label="Mật khẩu hiện tại">
              <input
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
              />
            </Field>
            <Field label="Mật khẩu mới">
              <input
                name="newPassword"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Xác nhận mật khẩu mới">
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>
            <FormError error={passError} />
            <Button loading={passBusy} variant="secondary" className="full">
              Đổi mật khẩu
            </Button>
          </form>
          <div className="panel system-info">
            <Database size={24} />
            <h3>Dữ liệu của bạn, tại máy chủ của bạn</h3>
            <p>
              Đơn hàng, tồn kho và tài khoản được lưu trong SQLite. Dữ liệu vẫn
              còn khi tải lại trang hoặc khởi động lại ứng dụng.
            </p>
            <div className="info-box">
              Bản mẫu có sẵn dữ liệu minh họa. Thẻ và chuyển khoản được xác nhận
              thủ công; chưa kết nối ngân hàng, giao vận và hóa đơn điện tử.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

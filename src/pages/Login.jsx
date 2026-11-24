import React, { useState } from "react";
import { Leaf, ArrowRight, Eye, EyeOff, Check, Building2 } from "lucide-react";
import { useApp } from "../store";
import { Button, Field, FormError, IconButton } from "../components/ui";
export default function Login() {
  const { login } = useApp();
  const [email, setEmail] = useState("admin@lafnb.vn"),
    [password, setPassword] = useState("LaFnb@2026"),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <a className="brand" href="#">
          <span className="brand-mark">
            <Leaf />
          </span>
          <span>
            lá<span className="brand-suffix">F&B</span>
          </span>
        </a>
        <div className="login-copy">
          <span className="eyebrow">GỌN VẬN HÀNH · TRỌN TRẢI NGHIỆM</span>
          <h1>
            Mỗi chi nhánh.
            <br />
            Một nhịp vận hành.
          </h1>
          <p>
            Từ ly cà phê đầu ngày đến báo cáo cuối ca.
            <br />
            Mọi điều bạn cần để chăm chút chuỗi F&B.
          </p>
          <div className="login-photo">
            <img src="/images/cafe.jpg" alt="Không gian quán cà phê ấm cúng" />
            <div>
              <span className="live-dot" /> Một không gian, mọi kết nối
            </div>
          </div>
          <div className="login-features">
            <span>
              <Check size={16} /> Quản lý tập trung
            </span>
            <span>
              <Check size={16} /> Dữ liệu theo chi nhánh
            </span>
          </div>
        </div>
        <small>Lá F&B · Được tạo cho những người làm dịch vụ</small>
      </section>
      <section className="login-form-section">
        <div className="login-form-wrap">
          <div className="login-symbol">
            <Building2 size={26} />
          </div>
          <span className="eyebrow">KHÔNG GIAN QUẢN LÝ CỦA BẠN</span>
          <h2>Chào mừng trở lại.</h2>
          <p>Đăng nhập để bắt đầu một ngày làm việc thật tốt.</p>
          <form onSubmit={submit}>
            <Field label="Email">
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Mật khẩu">
              <div className="password-input">
                <input
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <IconButton
                  label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  type="button"
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </IconButton>
              </div>
            </Field>
            <FormError error={error} />
            <Button loading={busy} type="submit" className="full">
              Đăng nhập <ArrowRight size={18} />
            </Button>
          </form>
          <div className="demo-box">
            <strong>Khám phá bản mẫu</strong>
            <p>3 chi nhánh, thực đơn và dữ liệu vận hành có sẵn.</p>
            <div className="demo-roles">
              {[
                ["admin", "Quản trị"],
                ["cashier", "Thu ngân"],
                ["kitchen", "Bếp"],
              ].map(([role, label]) => (
                <button
                  key={role}
                  className={email.startsWith(role) ? "selected" : ""}
                  onClick={() => {
                    setEmail(`${role}@lafnb.vn`);
                    setPassword("LaFnb@2026");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <small>
              Mật khẩu mẫu: <code>LaFnb@2026</code>
            </small>
          </div>
        </div>
        <small className="login-footer">
          Dữ liệu được lưu trên máy chủ của bạn.
        </small>
      </section>
    </div>
  );
}

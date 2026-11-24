import React, { useState } from "react";
import { Plus, Pencil, ShieldCheck, Users, MapPin } from "lucide-react";
import { useApp } from "../store";
import {
  PageHeading,
  Button,
  SearchBox,
  Modal,
  Field,
  FormError,
  Avatar,
  Empty,
} from "../components/ui";
import { roleLabels } from "../lib";
export default function Staff() {
  const { data, mutate } = useApp();
  const [query, setQuery] = useState(""),
    [modal, setModal] = useState(null),
    [role, setRole] = useState("cashier"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  function open(u) {
    setModal(u);
    setRole(u.role || "cashier");
    setError("");
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.target);
    try {
      await mutate(
        `/users${modal.id ? "/" + modal.id : ""}`,
        {
          name: f.get("name"),
          email: f.get("email"),
          phone: f.get("phone"),
          role,
          active: f.get("active") === "on",
          branchId: role === "admin" ? null : Number(f.get("branchId")),
          ...(f.get("password") ? { password: f.get("password") } : {}),
        },
        modal.id ? "PUT" : "POST",
        "Đã lưu tài khoản và phân quyền.",
      );
      setModal(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const filtered = data.users.filter((u) =>
    `${u.name} ${u.email}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="QUẢN LÝ TẬP TRUNG"
        title="Đội ngũ của Lá"
        description="Đúng người, đúng quyền, đúng chi nhánh."
      >
        <Button onClick={() => open({ active: 1 })}>
          <Plus size={18} />
          Thêm nhân viên
        </Button>
      </PageHeading>
      <div className="role-cards">
        {[
          [
            "admin",
            "Quản trị toàn chuỗi",
            "Quản lý chi nhánh, thực đơn, kho, nhân sự và báo cáo.",
          ],
          [
            "cashier",
            "Thu ngân chi nhánh",
            "Tạo đơn, quản lý bàn, khách hàng và ghi nhận thanh toán.",
          ],
          [
            "kitchen",
            "Nhân viên bếp",
            "Xem và cập nhật tiến độ chế biến tại chi nhánh được giao.",
          ],
        ].map(([r, t, d]) => (
          <div className="panel role-card" key={r}>
            <span
              className={`metric-icon ${r === "admin" ? "green" : r === "cashier" ? "orange" : "purple"}`}
            >
              <ShieldCheck size={22} />
            </span>
            <h3>{t}</h3>
            <p>{d}</p>
            <span className="soft-tag">
              {data.users.filter((u) => u.role === r && u.active).length} đang
              hoạt động
            </span>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="table-toolbar">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Tìm nhân viên..."
          />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Chi nhánh</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="person-cell">
                      <Avatar name={u.name} />
                      <div>
                        <strong>{u.name}</strong>
                        <small>{u.phone || "Chưa có số điện thoại"}</small>
                      </div>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>{roleLabels[u.role]}</td>
                  <td>
                    {u.role === "admin"
                      ? "Toàn chuỗi"
                      : data.branches.find((b) => b.id === u.branchId)?.name}
                  </td>
                  <td>
                    <span
                      className={`badge ${u.active ? "status-completed" : "status-cancelled"}`}
                    >
                      <i />
                      {u.active ? "Hoạt động" : "Đã khóa"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="icon-btn"
                      aria-label={`Sửa ${u.name}`}
                      onClick={() => open(u)}
                    >
                      <Pencil size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <Empty />}
      </div>
      {modal && (
        <Modal
          title={modal.id ? "Chỉnh sửa nhân viên" : "Thêm nhân viên"}
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          <form onSubmit={submit}>
            <Field label="Họ và tên">
              <input
                required
                name="name"
                maxLength={160}
                defaultValue={modal.name}
              />
            </Field>
            <div className="form-grid">
              <Field label="Email đăng nhập">
                <input
                  required
                  name="email"
                  type="email"
                  maxLength={160}
                  defaultValue={modal.email}
                />
              </Field>
              <Field label="Số điện thoại">
                <input
                  name="phone"
                  type="tel"
                  maxLength={20}
                  defaultValue={modal.phone}
                />
              </Field>
            </div>
            <Field label="Vai trò">
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {Object.entries(roleLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            {role !== "admin" && (
              <Field label="Chi nhánh làm việc">
                <select
                  name="branchId"
                  required
                  defaultValue={modal.branchId || data.branchId}
                >
                  {data.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field
              label={
                modal.id ? "Mật khẩu mới (để trống để giữ nguyên)" : "Mật khẩu"
              }
              hint="Tối thiểu 8 ký tự."
            >
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required={!modal.id}
              />
            </Field>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="active"
                defaultChecked={!!modal.active}
              />
              Tài khoản đang hoạt động
            </label>
            <FormError error={error} />
            <div className="modal-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setModal(null)}
              >
                Hủy
              </Button>
              <Button loading={busy}>Lưu nhân viên</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

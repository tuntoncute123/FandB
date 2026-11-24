import React, { useState } from "react";
import { Plus, Pencil, Users, Star, Download, History } from "lucide-react";
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
  Pagination,
  Status,
} from "../components/ui";
import { money, num, dateLabel, orderCode, downloadCSV } from "../lib";
export default function Customers() {
  const { data, mutate } = useApp();
  const [query, setQuery] = useState(""),
    [modal, setModal] = useState(null),
    [history, setHistory] = useState(null),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const filtered = data.customers.filter((c) =>
    `${c.name} ${c.phone} ${c.email}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.target);
    try {
      await mutate(
        `/customers${modal.id ? "/" + modal.id : ""}`,
        { name: f.get("name"), phone: f.get("phone"), email: f.get("email") },
        modal.id ? "PUT" : "POST",
        "Đã lưu thông tin khách hàng.",
      );
      setModal(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="QUẢN LÝ TẬP TRUNG"
        title="Khách hàng"
        description="Nhớ những vị khách quen, ở mọi chi nhánh."
      >
        <Button
          variant="secondary"
          onClick={() =>
            downloadCSV(
              "la-khach-hang.csv",
              ["Họ tên", "Điện thoại", "Email", "Điểm", "Chi tiêu", "Lượt ghé"],
              filtered.map((c) => [
                c.name,
                c.phone,
                c.email,
                c.points,
                c.spent,
                c.visits,
              ]),
            )
          }
        >
          <Download size={17} />
          Xuất dữ liệu
        </Button>
        <Button
          onClick={() => {
            setModal({});
            setError("");
          }}
        >
          <Plus size={18} />
          Thêm khách hàng
        </Button>
      </PageHeading>
      <div className="loyalty-banner">
        <div className="loyalty-icon">
          <Star size={26} />
        </div>
        <div>
          <h2>Mỗi lần ghé, thêm gắn kết</h2>
          <p>
            Tự động tích 1 điểm cho mỗi 10.000₫ thanh toán, dùng chung toàn
            chuỗi.
          </p>
        </div>
        <strong>
          {data.customers.length}
          <span>khách hàng đã kết nối</span>
        </strong>
      </div>
      <div className="panel">
        <div className="table-toolbar">
          <SearchBox
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Tìm tên, số điện thoại, email..."
          />
          <span className="muted">{filtered.length} khách hàng</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Khách hàng</th>
                <th>Liên hệ</th>
                <th>Hạng thành viên</th>
                <th>Tổng chi tiêu</th>
                <th>Lượt ghé</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.slice((page - 1) * 10, page * 10).map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="person-cell">
                      <Avatar name={c.name} />
                      <div>
                        <strong>{c.name}</strong>
                        <small>KH{String(c.id).padStart(4, "0")}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {c.phone}
                    <small className="cell-sub">
                      {c.email || "Chưa có email"}
                    </small>
                  </td>
                  <td>
                    <span
                      className={`member-tier ${c.points >= 200 ? "gold" : c.points >= 100 ? "silver" : ""}`}
                    >
                      <Star size={13} />
                      {c.points >= 200
                        ? "Lá Vàng"
                        : c.points >= 100
                          ? "Lá Bạc"
                          : "Lá Xanh"}
                    </span>
                    <small className="cell-sub">{num(c.points)} điểm</small>
                  </td>
                  <td className="strong">{money(c.spent)}</td>
                  <td>{c.visits}</td>
                  <td>
                    <div className="action-row">
                      <button
                        className="icon-btn"
                        aria-label={`Lịch sử ${c.name}`}
                        onClick={() => setHistory(c)}
                      >
                        <History size={17} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`Sửa ${c.name}`}
                        onClick={() => {
                          setModal(c);
                          setError("");
                        }}
                      >
                        <Pencil size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <Empty title="Chưa tìm thấy khách hàng" />}
        <Pagination page={page} setPage={setPage} total={filtered.length} />
      </div>
      {modal && (
        <Modal
          title={modal.id ? "Chỉnh sửa khách hàng" : "Thêm khách hàng"}
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          <form onSubmit={submit}>
            <Field label="Họ và tên">
              <input
                name="name"
                required
                maxLength={160}
                defaultValue={modal.name}
              />
            </Field>
            <Field label="Số điện thoại">
              <input
                name="phone"
                type="tel"
                required
                pattern="[+0-9][0-9 -]{8,14}"
                defaultValue={modal.phone}
              />
            </Field>
            <Field label="Email (không bắt buộc)">
              <input
                name="email"
                type="email"
                maxLength={160}
                defaultValue={modal.email}
              />
            </Field>
            <FormError error={error} />
            <div className="modal-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setModal(null)}
              >
                Hủy
              </Button>
              <Button loading={busy}>Lưu khách hàng</Button>
            </div>
          </form>
        </Modal>
      )}
      {history && (
        <Modal
          title={`Lịch sử · ${history.name}`}
          subtitle="Các đơn tại chi nhánh đang chọn. Điểm và tổng chi tiêu tính toàn chuỗi."
          onClose={() => setHistory(null)}
        >
          {data.orders.filter((o) => o.customerId === history.id).length ? (
            <div className="customer-history">
              {data.orders
                .filter((o) => o.customerId === history.id)
                .map((o) => (
                  <div key={o.id}>
                    <div>
                      <strong>{orderCode(o.id)}</strong>
                      <small>{dateLabel(o.createdAt)}</small>
                    </div>
                    <Status status={o.status} />
                    <b>{money(o.total)}</b>
                  </div>
                ))}
            </div>
          ) : (
            <Empty
              title="Chưa có đơn tại chi nhánh này"
              description="Chọn khách hàng trên POS để ghi nhận đơn và tích điểm."
            />
          )}
        </Modal>
      )}
    </>
  );
}

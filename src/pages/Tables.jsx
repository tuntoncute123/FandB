import React, { useState } from "react";
import {
  Plus,
  Users,
  Clock,
  UtensilsCrossed,
  CalendarClock,
  ArrowRight,
} from "lucide-react";
import { useApp } from "../store";
import {
  PageHeading,
  Button,
  Modal,
  Field,
  FormError,
  Empty,
} from "../components/ui";
import { activeOrders, money, timeLabel } from "../lib";
import { OrderDetail } from "./Orders";
export default function Tables() {
  const { data, navigate, setPosTable, mutate } = useApp();
  const [zone, setZone] = useState("Tất cả"),
    [filter, setFilter] = useState("all"),
    [modal, setModal] = useState(null),
    [selected, setSelected] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = activeOrders(data.orders);
  const occupied = active.filter((o) => o.tableId).length;
  const tables = data.tables.filter(
    (t) =>
      (zone === "Tất cả" || t.zone === zone) &&
      (filter === "all" ||
        (filter === "occupied" && active.some((o) => o.tableId === t.id)) ||
        (filter === "reserved" && t.reserved) ||
        (filter === "free" &&
          !t.reserved &&
          !active.some((o) => o.tableId === t.id))),
  );
  const choose = (t) => {
    const order = active.find((o) => o.tableId === t.id);
    if (order) setSelected(order.id);
    else setModal({ type: "table", table: t });
  };
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.target);
    try {
      if (modal.type === "add")
        await mutate(
          "/tables",
          {
            name: f.get("name"),
            zone: f.get("zone"),
            seats: Number(f.get("seats")),
          },
          "POST",
          "Đã thêm bàn.",
        );
      else
        await mutate(
          `/tables/${modal.table.id}`,
          { reserved: f.get("reserved") },
          "PATCH",
          "Đã cập nhật đặt bàn.",
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
        eyebrow="VẬN HÀNH"
        title="Sơ đồ bàn"
        description="Sắp xếp không gian. Sẵn sàng đón khách."
      >
        {data.user.role === "admin" && (
          <Button
            onClick={() => {
              setError("");
              setModal({ type: "add" });
            }}
          >
            <Plus size={18} />
            Thêm bàn
          </Button>
        )}
      </PageHeading>
      <div className="table-summary">
        <button
          className={filter === "all" ? "selected" : ""}
          onClick={() => setFilter("all")}
        >
          <UtensilsCrossed />
          <div>
            <strong>{data.tables.length}</strong>
            <span>Tất cả bàn</span>
          </div>
        </button>
        <button
          className={filter === "free" ? "selected" : ""}
          onClick={() => setFilter("free")}
        >
          <span className="table-indicator free" />
          <div>
            <strong>
              {data.tables.length -
                occupied -
                data.tables.filter((t) => t.reserved).length}
            </strong>
            <span>Bàn trống</span>
          </div>
        </button>
        <button
          className={filter === "occupied" ? "selected" : ""}
          onClick={() => setFilter("occupied")}
        >
          <span className="table-indicator occupied" />
          <div>
            <strong>{occupied}</strong>
            <span>Đang phục vụ</span>
          </div>
        </button>
        <button
          className={filter === "reserved" ? "selected" : ""}
          onClick={() => setFilter("reserved")}
        >
          <span className="table-indicator reserved" />
          <div>
            <strong>{data.tables.filter((t) => t.reserved).length}</strong>
            <span>Đã đặt trước</span>
          </div>
        </button>
      </div>
      <div className="zone-tabs category-tabs">
        {["Tất cả", ...new Set(data.tables.map((t) => t.zone))].map((z) => (
          <button
            className={zone === z ? "active" : ""}
            key={z}
            onClick={() => setZone(z)}
          >
            {z}
          </button>
        ))}
      </div>
      <div className="tables-grid">
        {tables.map((t) => {
          const order = active.find((o) => o.tableId === t.id);
          const status = order ? "occupied" : t.reserved ? "reserved" : "free";
          return (
            <button
              key={t.id}
              className={`dining-table ${status}`}
              onClick={() => choose(t)}
            >
              <div className="dining-table-top">
                <span>{t.zone}</span>
                <span>
                  <Users size={14} />
                  {t.seats} chỗ
                </span>
              </div>
              <div className="table-drawing">
                <span className="chair chair-1" />
                <span className="chair chair-2" />
                <span className="chair chair-3" />
                <span className="chair chair-4" />
                {t.seats >= 6 && (
                  <>
                    <span className="chair chair-5" />
                    <span className="chair chair-6" />
                  </>
                )}
                <div>
                  <UtensilsCrossed size={23} />
                  <strong>{t.name}</strong>
                </div>
              </div>
              <div className="dining-table-bottom">
                <span>
                  <i />
                  {order
                    ? "Đang phục vụ"
                    : t.reserved
                      ? "Đã đặt trước"
                      : "Sẵn sàng đón khách"}
                </span>
                {order ? (
                  <strong>{money(order.total)}</strong>
                ) : t.reserved ? (
                  <small>{t.reserved}</small>
                ) : (
                  <small>Chạm để tạo đơn hoặc đặt bàn</small>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {!tables.length && (
        <Empty
          title="Chưa có bàn phù hợp"
          description="Chọn khu vực khác hoặc thêm bàn mới."
        />
      )}
      {selected && (
        <OrderDetail id={selected} onClose={() => setSelected(null)} />
      )}{" "}
      {modal && (
        <Modal
          title={modal.type === "add" ? "Thêm bàn mới" : modal.table.name}
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          {modal.type === "table" ? (
            <>
              <div className="info-box">
                {modal.table.zone} · {modal.table.seats} chỗ ngồi
                {modal.table.reserved && (
                  <p>Đặt trước: {modal.table.reserved}</p>
                )}
              </div>
              <Button
                className="full"
                onClick={() => {
                  setPosTable(modal.table.id);
                  navigate("pos");
                }}
              >
                <Plus size={18} />
                Tạo đơn cho bàn này
              </Button>
              <form onSubmit={submit}>
                <Field
                  label="Thông tin đặt bàn"
                  hint="Nhập tên khách, số điện thoại, giờ đến. Để trống để bỏ đặt bàn."
                >
                  <input
                    name="reserved"
                    maxLength={250}
                    defaultValue={modal.table.reserved}
                    placeholder="VD: Chị Linh · 0901112233 · 19:00"
                  />
                </Field>
                <FormError error={error} />
                <div className="modal-actions">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setModal(null)}
                  >
                    Đóng
                  </Button>
                  <Button loading={busy}>
                    <CalendarClock size={17} />
                    Lưu đặt bàn
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <form onSubmit={submit}>
              <Field label="Tên bàn">
                <input
                  name="name"
                  required
                  maxLength={160}
                  placeholder="Bàn 13"
                />
              </Field>
              <div className="form-grid">
                <Field label="Khu vực">
                  <input
                    name="zone"
                    required
                    maxLength={160}
                    list="zones"
                    placeholder="Tầng 1"
                  />
                  <datalist id="zones">
                    {[...new Set(data.tables.map((t) => t.zone))].map((z) => (
                      <option key={z}>{z}</option>
                    ))}
                  </datalist>
                </Field>
                <Field label="Số chỗ">
                  <input
                    name="seats"
                    required
                    type="number"
                    min="1"
                    max="50"
                    defaultValue="4"
                  />
                </Field>
              </div>
              <FormError error={error} />
              <div className="modal-actions">
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setModal(null)}
                >
                  Hủy
                </Button>
                <Button loading={busy}>Thêm bàn</Button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

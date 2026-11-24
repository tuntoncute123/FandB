import React, { useState } from "react";
import {
  Plus,
  Download,
  Search,
  Printer,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  Check,
  Clock,
  UtensilsCrossed,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { useApp } from "../store";
import {
  PageHeading,
  Button,
  SearchBox,
  Status,
  Pagination,
  Empty,
  Modal,
  Field,
  FormError,
} from "../components/ui";
import {
  money,
  num,
  orderCode,
  timeLabel,
  dateLabel,
  typeLabels,
  statusLabels,
  activeOrders,
  paymentLabels,
  downloadCSV,
  printReceipt,
} from "../lib";
export function OrderDetail({ id, onClose }) {
  const { data, mutate, notify } = useApp();
  const order = data.orders.find((o) => o.id === id);
  const [mode, setMode] = useState("detail"),
    [payment, setPayment] = useState("cash"),
    [received, setReceived] = useState(""),
    [table, setTable] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!order) return null;
  const canSales = data.user.role !== "kitchen",
    isActive = !["completed", "cancelled"].includes(order.status);
  const next = { pending: "cooking", cooking: "ready", ready: "served" }[
    order.status
  ];
  async function action(path, body, method = "POST", message) {
    setBusy(true);
    setError("");
    try {
      await mutate(path, body, method, message);
      setMode("detail");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const freeTables = data.tables.filter(
    (t) =>
      !t.reserved && !activeOrders(data.orders).some((o) => o.tableId === t.id),
  );
  return (
    <Modal
      title={`Đơn hàng ${orderCode(order.id)}`}
      subtitle={`${dateLabel(order.createdAt)} · ${timeLabel(order.createdAt)} · ${order.staffName}`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="order-detail-meta">
        <span>
          <UtensilsCrossed size={17} />
          {order.tableName || typeLabels[order.type]}
        </span>
        <Status status={order.status} />
      </div>
      {order.customerName && (
        <p className="muted">
          Khách hàng: <strong>{order.customerName}</strong>
        </p>
      )}
      <div className="receipt-items">
        {order.items.map((i) => (
          <div key={i.id}>
            <span className="item-qty">{i.quantity}×</span>
            <div>
              <strong>{i.name}</strong>
              <small>{money(i.price)} / món</small>
            </div>
            <b>{money(i.price * i.quantity)}</b>
          </div>
        ))}
      </div>
      {order.note && (
        <div className="order-note">
          <strong>Ghi chú:</strong> {order.note}
        </div>
      )}
      <div className="totals">
        <div>
          <span>Tạm tính</span>
          <span>{money(order.subtotal)}</span>
        </div>
        <div>
          <span>Giảm giá</span>
          <span>−{money(order.discount)}</span>
        </div>
        <div>
          <span>Thuế</span>
          <span>{money(order.tax)}</span>
        </div>
        <div className="grand-total">
          <span>Tổng thanh toán</span>
          <strong>{money(order.total)}</strong>
        </div>
      </div>
      {order.status === "completed" && (
        <div className="payment-success">
          <Check size={20} />
          <div>
            <strong>Đã thanh toán · {paymentLabels[order.payment]}</strong>
            <small>
              {dateLabel(order.paidAt)} {timeLabel(order.paidAt)}
              {order.payment === "cash"
                ? ` · Tiền thừa: ${money(order.received - order.total)}`
                : ""}
            </small>
          </div>
        </div>
      )}
      <FormError error={error} />
      {mode === "pay" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            action(
              `/orders/${id}/pay`,
              {
                payment,
                received: payment === "cash" ? Number(received) : order.total,
              },
              "POST",
              "Đã ghi nhận thanh toán và giải phóng bàn.",
            );
          }}
        >
          <div className="payment-options">
            {Object.entries(paymentLabels).map(([key, label]) => (
              <button
                type="button"
                key={key}
                className={payment === key ? "selected" : ""}
                onClick={() => setPayment(key)}
              >
                {key === "cash" ? (
                  <Banknote size={19} />
                ) : (
                  <CreditCard size={19} />
                )}
                <span>{label}</span>
              </button>
            ))}
          </div>
          {payment === "cash" ? (
            <>
              <Field label="Tiền khách đưa (₫)">
                <input
                  type="number"
                  min={order.total}
                  step="1"
                  required
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                />
              </Field>
              <div className="cash-suggestions">
                {[
                  order.total,
                  ...[100000, 200000, 500000, 1000000]
                    .filter((n) => n > order.total)
                    .slice(0, 3),
                ].map((n) => (
                  <button type="button" key={n} onClick={() => setReceived(n)}>
                    {money(n)}
                  </button>
                ))}
              </div>
              <div className="change-due">
                Tiền thừa{" "}
                <strong>
                  {money(Math.max(0, Number(received) - order.total))}
                </strong>
              </div>
            </>
          ) : (
            <div className="info-box">
              Chỉ xác nhận sau khi đã kiểm tra tiền vào tài khoản hoặc giao dịch
              trên máy POS. Hệ thống ghi nhận thanh toán thủ công.
            </div>
          )}
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMode("detail")}
            >
              Quay lại
            </Button>
            <Button type="submit" loading={busy}>
              <Check size={17} />
              Xác nhận đã thu tiền
            </Button>
          </div>
        </form>
      ) : mode === "cancel" ? (
        <div className="cancel-confirm">
          <h3>Hủy đơn hàng này?</h3>
          <p>
            Nguyên liệu của đơn sẽ được hoàn lại kho. Nếu món đã chế biến, ghi
            nhận hao hụt trong kho để phản ánh tồn thực tế.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setMode("detail")}>
              Giữ đơn
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                action(
                  `/orders/${id}/status`,
                  { status: "cancelled" },
                  "PATCH",
                  "Đã hủy đơn và hoàn kho.",
                )
              }
            >
              Xác nhận hủy
            </Button>
          </div>
        </div>
      ) : mode === "move" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            action(
              `/orders/${id}/table`,
              { tableId: Number(table) },
              "PATCH",
              "Đã chuyển bàn.",
            );
          }}
        >
          <Field label="Chuyển sang bàn">
            <select
              required
              value={table}
              onChange={(e) => setTable(e.target.value)}
            >
              <option value="">Chọn bàn trống</option>
              {freeTables.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.name} · {t.zone}
                </option>
              ))}
            </select>
          </Field>
          <div className="modal-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMode("detail")}
            >
              Quay lại
            </Button>
            <Button loading={busy}>Chuyển bàn</Button>
          </div>
        </form>
      ) : (
        <div className="detail-actions">
          <div className="action-row">
            <Button
              variant="secondary"
              onClick={() => {
                if (!printReceipt(order, data.settings))
                  notify(
                    "Trình duyệt đang chặn cửa sổ in. Cho phép cửa sổ bật lên để in.",
                    "error",
                  );
              }}
            >
              <Printer size={17} />
              In phiếu
            </Button>
            {isActive && canSales && order.type === "dinein" && (
              <Button variant="secondary" onClick={() => setMode("move")}>
                <ArrowRightLeft size={16} />
                Chuyển bàn
              </Button>
            )}
            {isActive && canSales && (
              <button className="text-danger" onClick={() => setMode("cancel")}>
                Hủy đơn
              </button>
            )}
          </div>
          {isActive && (
            <div className="action-row">
              {next && (canSales || next !== "served") && (
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={() =>
                    action(
                      `/orders/${id}/status`,
                      { status: next },
                      "PATCH",
                      `Đã cập nhật: ${statusLabels[next]}`,
                    )
                  }
                >
                  {next === "cooking"
                    ? "Bắt đầu chế biến"
                    : next === "ready"
                      ? "Món đã sẵn sàng"
                      : "Đánh dấu đã phục vụ"}
                  <ArrowRight size={16} />
                </Button>
              )}
              {canSales && ["ready", "served"].includes(order.status) && (
                <Button
                  onClick={() => {
                    setReceived(order.total);
                    setMode("pay");
                  }}
                >
                  <CreditCard size={17} />
                  Thanh toán
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
export default function Orders() {
  const { data, navigate } = useApp();
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("active"),
    [type, setType] = useState("all"),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState(null);
  const filtered = data.orders.filter(
    (o) =>
      (status === "all" ||
        (status === "active"
          ? !["completed", "cancelled"].includes(o.status)
          : o.status === status)) &&
      (type === "all" || o.type === type) &&
      `${orderCode(o.id)} ${o.tableName || ""} ${o.customerName || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const change = (setter, value) => {
    setter(value);
    setPage(1);
  };
  const exportData = () =>
    downloadCSV(
      "la-don-hang.csv",
      [
        "Mã đơn",
        "Ngày",
        "Hình thức",
        "Bàn",
        "Khách hàng",
        "Trạng thái",
        "Tổng tiền",
        "Thanh toán",
      ],
      filtered.map((o) => [
        orderCode(o.id),
        dateLabel(o.createdAt),
        typeLabels[o.type],
        o.tableName,
        o.customerName,
        statusLabels[o.status],
        o.total,
        paymentLabels[o.payment],
      ]),
    );
  return (
    <>
      <PageHeading
        eyebrow="VẬN HÀNH"
        title="Đơn hàng"
        description="Theo dõi từng đơn, chăm chút từng trải nghiệm."
      >
        <Button variant="secondary" onClick={exportData}>
          <Download size={17} />
          Xuất dữ liệu
        </Button>
        <Button onClick={() => navigate("pos")}>
          <Plus size={18} />
          Tạo đơn mới
        </Button>
      </PageHeading>
      <div className="panel">
        <div className="tabs">
          {[
            ["active", "Đang phục vụ"],
            ["completed", "Hoàn thành"],
            ["cancelled", "Đã hủy"],
            ["all", "Tất cả"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={status === key ? "active" : ""}
              onClick={() => change(setStatus, key)}
            >
              {label}
              {key === "active" && (
                <span>{activeOrders(data.orders).length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <SearchBox
            value={query}
            onChange={(v) => change(setQuery, v)}
            placeholder="Tìm mã đơn, bàn hoặc khách hàng..."
          />
          <select
            aria-label="Hình thức phục vụ"
            value={type}
            onChange={(e) => change(setType, e.target.value)}
          >
            <option value="all">Tất cả hình thức</option>
            {Object.entries(typeLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mã đơn / Thời gian</th>
                <th>Phục vụ</th>
                <th>Khách hàng</th>
                <th>Số món</th>
                <th>Tổng tiền</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.slice((page - 1) * 10, page * 10).map((o) => (
                <tr key={o.id}>
                  <td>
                    <button
                      className="table-link"
                      onClick={() => setSelected(o.id)}
                    >
                      {orderCode(o.id)}
                    </button>
                    <small className="cell-sub">
                      {dateLabel(o.createdAt)} · {timeLabel(o.createdAt)}
                    </small>
                  </td>
                  <td>
                    {o.tableName || typeLabels[o.type]}
                    <small className="cell-sub">{typeLabels[o.type]}</small>
                  </td>
                  <td>{o.customerName || "Khách lẻ"}</td>
                  <td>{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="strong">{money(o.total)}</td>
                  <td>
                    <Status status={o.status} />
                  </td>
                  <td>
                    <button
                      className="text-link"
                      onClick={() => setSelected(o.id)}
                    >
                      Chi tiết <ArrowRight size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <Empty
            title="Không có đơn hàng phù hợp"
            description="Thử bộ lọc khác hoặc tạo đơn hàng mới."
          />
        )}
        <Pagination page={page} setPage={setPage} total={filtered.length} />
      </div>
      {selected && (
        <OrderDetail id={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

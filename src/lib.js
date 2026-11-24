export const money = (n) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n || 0);
export const num = (n) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(n || 0);
export const dayKey = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
export const dateLabel = (d) =>
  new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
export const timeLabel = (d) =>
  new Date(d).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
export const orderCode = (id) => `#LA-${id + 1000}`;
export const activeOrders = (orders) =>
  orders.filter((o) => !["completed", "cancelled"].includes(o.status));
export const statusLabels = {
  pending: "Chờ xác nhận",
  cooking: "Đang chế biến",
  ready: "Sẵn sàng",
  served: "Đã phục vụ",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};
export const typeLabels = {
  dinein: "Tại bàn",
  takeaway: "Mang đi",
  delivery: "Giao hàng",
};
export const paymentLabels = {
  cash: "Tiền mặt",
  transfer: "Chuyển khoản",
  card: "Thẻ ngân hàng",
};
export const roleLabels = {
  admin: "Quản trị viên",
  cashier: "Thu ngân",
  kitchen: "Nhân viên bếp",
};
export const categories = [
  "Cà phê",
  "Trà & trái cây",
  "Món chính",
  "Bánh ngọt",
];
export function downloadCSV(filename, headers, rows) {
  const cell = (v) =>
    `"${String(v ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""')}"`;
  const blob = new Blob(
    [
      "\ufeff" +
        [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8;" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function printReceipt(order, settings) {
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const w = window.open("", "_blank", "width=480,height=760");
  if (!w) return false;
  w.document.write(
    `<!doctype html><html lang="vi"><head><title>Hóa đơn ${esc(orderCode(order.id))}</title><style>body{font:15px/1.6 sans-serif;max-width:360px;margin:30px auto;padding:20px}h1{font-size:24px;margin:0}header,footer{text-align:center}table{width:100%;border-collapse:collapse}td{padding:7px 0;border-bottom:1px dashed #ccc}td:last-child{text-align:right}p{margin:8px 0}.total{font-size:20px;font-weight:bold}@media print{body{margin:0;padding:10px}}</style></head><body><header><h1>${esc(settings.name)}</h1><p>${esc(settings.address)}<br>${esc(settings.phone)}</p><h2>HÓA ĐƠN BÁN HÀNG</h2></header><p>${esc(orderCode(order.id))} · ${esc(dateLabel(order.createdAt))} ${esc(timeLabel(order.createdAt))}<br>${esc(order.tableName || typeLabels[order.type])} · ${esc(order.staffName)}</p><table>${order.items.map((i) => `<tr><td>${esc(i.name)}<br>${i.quantity} × ${esc(money(i.price))}</td><td>${esc(money(i.quantity * i.price))}</td></tr>`).join("")}</table><p>Tạm tính: ${esc(money(order.subtotal))}<br>Giảm giá: ${esc(money(order.discount))}<br>Thuế: ${esc(money(order.tax))}</p><p class="total">Tổng cộng: ${esc(money(order.total))}</p><p>${order.status === "completed" ? `Đã thanh toán · ${esc(paymentLabels[order.payment])}` : "CHƯA THANH TOÁN"}</p><footer><p>${esc(settings.receiptNote)}</p><small>Phiếu bán hàng nội bộ · Không thay thế hóa đơn điện tử</small></footer><script>window.onload=()=>window.print()<\/script></body></html>`,
  );
  w.document.close();
  return true;
}
export function revenueDays(orders, count = 7) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (count - 1 - i));
    const key = dayKey(d);
    const paid = orders.filter(
      (o) => o.status === "completed" && dayKey(o.paidAt) === key,
    );
    return {
      date: key,
      label: d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      }),
      value: paid.reduce((s, o) => s + o.total, 0),
      orders: paid.length,
    };
  });
}

export function newRequestKey() {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = [...bytes].map((v) => v.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

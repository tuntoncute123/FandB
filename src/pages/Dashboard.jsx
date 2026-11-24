import React, { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Plus,
  Wallet,
  ShoppingBag,
  ReceiptText,
  UtensilsCrossed,
  Package,
  Clock,
  Download,
  Leaf,
} from "lucide-react";
import { useApp } from "../store";
import {
  Button,
  Metric,
  PageHeading,
  Status,
  ProductImage,
  Empty,
} from "../components/ui";
import { RevenueChart, Donut } from "../components/Charts";
import {
  activeOrders,
  money,
  num,
  dayKey,
  timeLabel,
  orderCode,
  revenueDays,
  downloadCSV,
  typeLabels,
} from "../lib";
import { OrderDetail } from "./Orders";
export default function Dashboard() {
  const { data, navigate } = useApp();
  const [days, setDays] = useState(7),
    [selected, setSelected] = useState(null);
  const today = dayKey();
  const paid = data.orders.filter(
      (o) => o.status === "completed" && dayKey(o.paidAt) === today,
    ),
    revenue = paid.reduce((s, o) => s + o.total, 0),
    active = activeOrders(data.orders),
    occupied = new Set(active.filter((o) => o.tableId).map((o) => o.tableId));
  const chart = revenueDays(data.orders, days);
  const totalChart = chart.reduce((s, d) => s + d.value, 0);
  const quantities = {};
  for (const o of paid)
    for (const i of o.items) {
      quantities[i.productId] ??= { quantity: 0, revenue: 0 };
      quantities[i.productId].quantity += i.quantity;
      quantities[i.productId].revenue += i.quantity * i.price;
    }
  const best = Object.entries(quantities)
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 4);
  const low = data.ingredients.filter((i) => i.stock <= i.threshold);
  const date = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <>
      <PageHeading
        title={`Chào ${data.user.name.split(" ").slice(-2).join(" ")}, một ngày tốt lành ☀`}
        description="Một góc nhìn trọn vẹn về hoạt động kinh doanh hôm nay."
      >
        <span className="date-chip">
          <CalendarDays size={17} />
          {date}
        </span>
        {data.user.role !== "kitchen" && (
          <Button onClick={() => navigate("pos")}>
            <Plus size={18} />
            Tạo đơn mới
          </Button>
        )}
      </PageHeading>
      <section className="overview-banner">
        <div>
          <span className="banner-pill">
            <span className="live-dot" /> ĐANG MỞ CỬA
          </span>
          <h2>
            Chăm chút từng món.
            <br />
            Nhẹ nhàng từng ca.
          </h2>
          <p>
            {data.branches.find((b) => b.id === data.branchId)?.name}{" "}
            <span>·</span> {active.length} đơn đang phục vụ
          </p>
        </div>
        <div className="banner-visual">
          <span className="banner-ring ring-one" />
          <span className="banner-ring ring-two" />
          <div className="banner-coffee">
            <img src="/images/latte.jpg" alt="Một tách latte tại Lá" />
          </div>
          <div className="banner-note">
            <Leaf size={19} />
            <div>
              <strong>Good food. Good mood.</strong>
              <span>Mỗi ngày, cùng Lá.</span>
            </div>
          </div>
        </div>
      </section>
      <div className="metrics-grid">
        <Metric
          label="Doanh thu hôm nay"
          value={money(revenue)}
          detail="Từ các đơn đã thanh toán"
          icon={Wallet}
        />
        <Metric
          label="Đơn hàng hôm nay"
          value={num(
            data.orders.filter(
              (o) => dayKey(o.createdAt) === today && o.status !== "cancelled",
            ).length,
          )}
          detail={`${paid.length} đơn đã hoàn thành`}
          icon={ShoppingBag}
          tone="orange"
        />
        <Metric
          label="Giá trị đơn trung bình"
          value={money(paid.length ? revenue / paid.length : 0)}
          detail="Doanh thu / đơn hoàn thành"
          icon={ReceiptText}
          tone="purple"
        />
        <Metric
          label="Bàn đang phục vụ"
          value={
            <>
              {occupied.size}
              <span className="metric-denominator">
                {" "}
                / {data.tables.length}
              </span>
            </>
          }
          detail={`${data.tables.length - occupied.size - data.tables.filter((t) => t.reserved).length} bàn trống · ${data.tables.filter((t) => t.reserved).length} đặt trước`}
          icon={UtensilsCrossed}
          tone="blue"
        />
      </div>
      <div className="dashboard-middle">
        <section className="panel revenue-panel">
          <div className="panel-header">
            <div>
              <h2>Nhịp doanh thu</h2>
              <p>Tổng quan doanh thu theo ngày</p>
            </div>
            <div className="segmented compact">
              {[7, 14].map((n) => (
                <button
                  key={n}
                  className={days === n ? "selected" : ""}
                  onClick={() => setDays(n)}
                >
                  {n} ngày
                </button>
              ))}
            </div>
          </div>
          <div className="chart-summary">
            <strong>{money(totalChart)}</strong>
            <span>
              <i className="legend-dot" /> Doanh thu thực thu
            </span>
          </div>
          <RevenueChart data={chart} />
          <div className="panel-bottom">
            <span>
              {chart[0].label} – {chart.at(-1).label}
            </span>
            {data.user.role === "admin" && (
              <button className="text-link" onClick={() => navigate("reports")}>
                Xem báo cáo chi tiết <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </section>
        <section className="panel best-panel">
          <div className="panel-header">
            <div>
              <h2>Được yêu thích hôm nay</h2>
              <p>Những món khách chọn nhiều nhất</p>
            </div>
            <span className="tiny-badge">TOP 4</span>
          </div>
          {best.length ? (
            <div className="bestsellers">
              {best.map(([id, stats], idx) => {
                const p = data.products.find((p) => p.id === Number(id));
                return (
                  <div className="bestseller" key={id}>
                    <span className="rank">0{idx + 1}</span>
                    <ProductImage product={p} />
                    <div>
                      <strong>{p.name}</strong>
                      <span>{stats.quantity} món đã bán</span>
                    </div>
                    <b>{money(stats.revenue)}</b>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty
              title="Chưa có món bán hôm nay"
              description="Món bán chạy xuất hiện sau khi thanh toán."
            />
          )}
          <div className="best-bottom">
            <span className="mini-leaf">
              <Leaf size={16} />
            </span>{" "}
            Món ngon tạo nên những lần quay lại.
          </div>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel recent-panel">
          <div className="panel-header">
            <div>
              <h2>
                Đơn hàng gần đây{" "}
                <span className="count-bubble">{active.length} đang mở</span>
              </h2>
              <p>Mọi đơn hàng, trong tầm mắt</p>
            </div>
            <button className="text-link" onClick={() => navigate("orders")}>
              Xem tất cả <ArrowRight size={16} />
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Phục vụ</th>
                  <th>Tổng tiền</th>
                  <th>Trạng thái</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.slice(0, 5).map((o) => (
                  <tr
                    key={o.id}
                    className="clickable"
                    onClick={() => setSelected(o.id)}
                  >
                    <td>
                      <button
                        className="table-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(o.id);
                        }}
                      >
                        {orderCode(o.id)}
                      </button>
                    </td>
                    <td>{o.tableName || typeLabels[o.type]}</td>
                    <td className="strong">{money(o.total)}</td>
                    <td>
                      <Status status={o.status} />
                    </td>
                    <td className="muted">{timeLabel(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.orders.length && <Empty />}
          </div>
        </section>
        <section className="panel daily-mix">
          <div className="panel-header">
            <div>
              <h2>Hình thức phục vụ</h2>
              <p>Cơ cấu đơn hoàn thành hôm nay</p>
            </div>
          </div>
          <Donut
            values={Object.entries(typeLabels).map(([key, label]) => ({
              label,
              value: paid.filter((o) => o.type === key).length,
            }))}
            total={paid.length}
          />
          {data.user.role === "admin" && (
            <button
              className="stock-alert"
              onClick={() => navigate("inventory")}
            >
              <span>
                <Package size={19} />
              </span>
              <div>
                <strong>{low.length} nguyên liệu cần bổ sung</strong>
                <small>Kiểm tra tồn kho chi nhánh</small>
              </div>
              <ArrowUpRight size={17} />
            </button>
          )}
        </section>
      </div>
      {selected && (
        <OrderDetail id={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

import React, { useState } from "react";
import {
  Download,
  Wallet,
  ShoppingBag,
  TrendingUp,
  ReceiptText,
  CalendarDays,
} from "lucide-react";
import { useApp } from "../store";
import {
  PageHeading,
  Button,
  Metric,
  ProductImage,
  Empty,
} from "../components/ui";
import { RevenueChart, Donut } from "../components/Charts";
import {
  money,
  num,
  dayKey,
  revenueDays,
  paymentLabels,
  downloadCSV,
  orderCode,
  dateLabel,
} from "../lib";
export default function Reports() {
  const { data } = useApp();
  const [days, setDays] = useState(7);
  const chart = revenueDays(data.orders, days);
  const from = chart[0].date,
    to = chart.at(-1).date;
  const orders = data.orders.filter(
    (o) =>
      o.status === "completed" &&
      dayKey(o.paidAt) >= from &&
      dayKey(o.paidAt) <= to,
  );
  const revenue = orders.reduce((s, o) => s + o.total, 0),
    tax = orders.reduce((s, o) => s + o.tax, 0),
    discount = orders.reduce((s, o) => s + o.discount, 0),
    cost = orders.reduce(
      (s, o) => s + o.items.reduce((a, i) => a + i.cost * i.quantity, 0),
      0,
    );
  const products = {};
  for (const o of orders)
    for (const i of o.items) {
      products[i.productId] ??= {
        product: data.products.find((p) => p.id === i.productId),
        quantity: 0,
        revenue: 0,
        cost: 0,
      };
      products[i.productId].quantity += i.quantity;
      products[i.productId].revenue += i.price * i.quantity;
      products[i.productId].cost += i.cost * i.quantity;
    }
  const best = Object.values(products).sort((a, b) => b.revenue - a.revenue);
  return (
    <>
      <PageHeading
        eyebrow="PHÂN TÍCH"
        title="Báo cáo kinh doanh"
        description="Hiểu những con số. Tìm hướng đi tiếp theo."
      >
        <select
          aria-label="Khoảng thời gian báo cáo"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>7 ngày gần nhất</option>
          <option value={14}>14 ngày gần nhất</option>
          <option value={30}>30 ngày gần nhất</option>
        </select>
        <Button
          variant="secondary"
          onClick={() =>
            downloadCSV(
              `la-doanh-thu-${from}-${to}.csv`,
              [
                "Mã đơn",
                "Ngày thanh toán",
                "Tạm tính",
                "Giảm giá",
                "Thuế",
                "Tổng thu",
                "Phương thức",
              ],
              orders.map((o) => [
                orderCode(o.id),
                dateLabel(o.paidAt),
                o.subtotal,
                o.discount,
                o.tax,
                o.total,
                paymentLabels[o.payment],
              ]),
            )
          }
        >
          <Download size={17} />
          Xuất báo cáo
        </Button>
      </PageHeading>
      <div className="report-period">
        <CalendarDays size={16} />
        Từ {from.split("-").reverse().join("/")} đến{" "}
        {to.split("-").reverse().join("/")}{" "}
        <span>· Chỉ tính đơn đã thanh toán</span>
      </div>
      <div className="metrics-grid">
        <Metric
          label="Tổng doanh thu"
          value={money(revenue)}
          detail={`Gồm ${money(tax)} thuế`}
          icon={Wallet}
        />
        <Metric
          label="Đơn hoàn thành"
          value={num(orders.length)}
          detail={`${money(orders.length ? revenue / orders.length : 0)} / đơn`}
          icon={ShoppingBag}
          tone="orange"
        />
        <Metric
          label="Lãi gộp ước tính"
          value={money(revenue - tax - cost)}
          detail="Sau giảm giá, chưa trừ chi phí vận hành"
          icon={TrendingUp}
          tone="purple"
        />
        <Metric
          label="Tổng giảm giá"
          value={money(discount)}
          detail="Giảm trực tiếp trên đơn hàng"
          icon={ReceiptText}
          tone="blue"
        />
      </div>
      <div className="reports-charts">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Diễn biến doanh thu</h2>
              <p>Doanh thu thực thu theo ngày thanh toán</p>
            </div>
            <span className="soft-tag">VND</span>
          </div>
          <RevenueChart data={chart} />
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Phương thức thanh toán</h2>
              <p>Tỷ trọng theo số tiền đã ghi nhận</p>
            </div>
          </div>
          <Donut
            total={orders.length}
            values={Object.entries(paymentLabels).map(([key, label]) => ({
              label,
              value: orders
                .filter((o) => o.payment === key)
                .reduce((s, o) => s + o.total, 0),
            }))}
          />
        </section>
      </div>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Hiệu quả từng món</h2>
            <p>
              Doanh thu món trước giảm giá và thuế. Giá vốn chụp lại tại thời
              điểm bán.
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Món</th>
                <th>Danh mục</th>
                <th>Số lượng bán</th>
                <th>Doanh thu món</th>
                <th>Giá vốn</th>
                <th>Lãi gộp món</th>
                <th>Tỷ trọng</th>
              </tr>
            </thead>
            <tbody>
              {best.map((b) => (
                <tr key={b.product.id}>
                  <td>
                    <div className="product-cell">
                      <ProductImage product={b.product} />
                      <strong>{b.product.name}</strong>
                    </div>
                  </td>
                  <td>{b.product.category}</td>
                  <td>{b.quantity}</td>
                  <td className="strong">{money(b.revenue)}</td>
                  <td>{money(b.cost)}</td>
                  <td className="text-green">{money(b.revenue - b.cost)}</td>
                  <td>
                    <div className="share-bar">
                      <span
                        style={{
                          width: `${(b.revenue / (revenue - tax + discount || 1)) * 100}%`,
                        }}
                      />
                    </div>
                    <small className="muted">
                      {(
                        (b.revenue / (revenue - tax + discount || 1)) *
                        100
                      ).toFixed(1)}
                      %
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!best.length && (
          <Empty
            title="Chưa có doanh thu trong kỳ"
            description="Báo cáo được cập nhật sau khi đơn hàng thanh toán thành công."
          />
        )}
      </section>
      <p className="report-disclaimer">
        Lãi gộp là ước tính từ giá vốn món, chưa bao gồm lương, thuê mặt bằng và
        các chi phí vận hành khác.
      </p>
    </>
  );
}

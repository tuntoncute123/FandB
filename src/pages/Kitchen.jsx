import React, { useEffect, useState } from "react";
import {
  ChefHat,
  Clock,
  RefreshCw,
  ArrowRight,
  Check,
  Volume2,
} from "lucide-react";
import { useApp } from "../store";
import { PageHeading, Button, Empty } from "../components/ui";
import { activeOrders, orderCode, typeLabels, timeLabel } from "../lib";
export default function Kitchen() {
  const { data, mutate, refresh, notify } = useApp();
  const [busy, setBusy] = useState(null),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  const orders = activeOrders(data.orders)
    .filter((o) => o.status !== "served")
    .sort((a, b) => a.id - b.id);
  async function update(order, status) {
    setBusy(order.id);
    try {
      await mutate(
        `/orders/${order.id}/status`,
        { status },
        "PATCH",
        status === "cooking"
          ? "Đã bắt đầu chế biến."
          : "Món đã sẵn sàng phục vụ.",
      );
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="VẬN HÀNH"
        title="Màn hình bếp"
        description="Đồng bộ từng món, nhịp nhàng từng đơn."
      >
        <span className="soft-tag">
          <span className="live-dot" />
          Cập nhật mỗi 15 giây
        </span>
        <Button variant="secondary" onClick={() => refresh()}>
          <RefreshCw size={17} />
          Làm mới
        </Button>
      </PageHeading>
      <div className="kitchen-board">
        {[
          ["pending", "Chờ xác nhận", "Bắt đầu chế biến", "cooking"],
          ["cooking", "Đang chế biến", "Món đã sẵn sàng", "ready"],
          ["ready", "Sẵn sàng phục vụ", "Đã phục vụ", "served"],
        ].map(([status, label, action, next]) => (
          <section className={`kitchen-column ${status}`} key={status}>
            <header>
              <h2>
                <i />
                {label}
              </h2>
              <span>{orders.filter((o) => o.status === status).length}</span>
            </header>
            <div className="kitchen-stack">
              {orders
                .filter((o) => o.status === status)
                .map((o) => {
                  const minutes = Math.max(
                    0,
                    Math.floor((now - new Date(o.createdAt).getTime()) / 60000),
                  );
                  return (
                    <article className="kitchen-ticket" key={o.id}>
                      <div className="ticket-heading">
                        <div>
                          <h3>{o.tableName || typeLabels[o.type]}</h3>
                          <span>
                            {orderCode(o.id)} · {timeLabel(o.createdAt)}
                          </span>
                        </div>
                        <span
                          className={`elapsed ${minutes > 15 ? "late" : ""}`}
                        >
                          <Clock size={14} />
                          {minutes} phút
                        </span>
                      </div>
                      <div className="ticket-items">
                        {o.items.map((i) => (
                          <div key={i.id}>
                            <b>{i.quantity}</b>
                            <span>{i.name}</span>
                          </div>
                        ))}
                      </div>
                      {o.note && <div className="order-note">{o.note}</div>}
                      {status !== "ready" || data.user.role !== "kitchen" ? (
                        <Button
                          className="full"
                          variant={
                            status === "cooking" ? "primary" : "secondary"
                          }
                          loading={busy === o.id}
                          onClick={() => update(o, next)}
                        >
                          {action}
                          {status === "ready" ? (
                            <Check size={17} />
                          ) : (
                            <ArrowRight size={17} />
                          )}
                        </Button>
                      ) : (
                        <div className="ready-note">
                          <Check size={16} />
                          Chờ nhân viên phục vụ
                        </div>
                      )}
                    </article>
                  );
                })}
              {!orders.some((o) => o.status === status) && (
                <div className="kitchen-empty">
                  <ChefHat size={28} />
                  <span>Chưa có đơn trong mục này</span>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

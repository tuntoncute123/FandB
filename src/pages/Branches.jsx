import React, { useEffect, useState } from "react";
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  ArrowUpRight,
  Wallet,
  ShoppingBag,
  Package,
  RefreshCw,
  Download,
} from "lucide-react";
import { useApp } from "../store";
import {
  PageHeading,
  Button,
  Metric,
  Modal,
  Field,
  FormError,
  Empty,
} from "../components/ui";
import { RevenueChart } from "../components/Charts";
import {
  dayKey,
  money,
  num,
  revenueDays,
  activeOrders,
  downloadCSV,
} from "../lib";
export default function Branches() {
  const { api, mutate, data, switchBranch, navigate } = useApp();
  const [chain, setChain] = useState(null),
    [error, setError] = useState(""),
    [modal, setModal] = useState(false),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState(""),
    [days, setDays] = useState(7);
  async function load() {
    try {
      setChain(await api("/chain"));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);
  const allOrders = chain?.branches.flatMap((b) => b.orders) || [];
  const chart = revenueDays(allOrders, days);
  const from = chart[0].date;
  const inPeriod = (o) =>
    o.status === "completed" &&
    dayKey(o.paidAt) >= from &&
    dayKey(o.paidAt) <= dayKey();
  const branches =
    chain?.branches.map((b) => {
      const paid = b.orders.filter(inPeriod);
      return {
        ...b,
        revenue: paid.reduce((s, o) => s + o.total, 0),
        paidCount: paid.length,
        active: activeOrders(b.orders).length,
        low: b.ingredients.filter((i) => i.stock <= i.threshold).length,
      };
    }) || [];
  const total = branches.reduce((s, b) => s + b.revenue, 0);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    const f = new FormData(e.target);
    try {
      await mutate(
        "/branches",
        {
          name: f.get("name"),
          address: f.get("address"),
          phone: f.get("phone"),
        },
        "POST",
        "Đã mở chi nhánh mới. Thêm bàn, nhập kho và phân công nhân viên để bắt đầu.",
      );
      await load();
      setModal(false);
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="QUẢN LÝ TẬP TRUNG"
        title="Một chuỗi. Một góc nhìn."
        description="Kết nối mọi chi nhánh và theo dõi sức khỏe toàn hệ thống."
      >
        <select
          aria-label="Khoảng thời gian toàn chuỗi"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={1}>Hôm nay</option>
          <option value={7}>7 ngày gần nhất</option>
          <option value={14}>14 ngày gần nhất</option>
        </select>
        <Button
          onClick={() => {
            setModal(true);
            setFormError("");
          }}
        >
          <Plus size={18} />
          Mở chi nhánh
        </Button>
      </PageHeading>
      <FormError error={error} />
      {error && (
        <Button variant="secondary" onClick={load}>
          Thử lại
        </Button>
      )}
      {!chain && !error ? (
        <div className="empty">Đang tổng hợp dữ liệu toàn chuỗi...</div>
      ) : (
        <>
          <div className="metrics-grid">
            <Metric
              label="Chi nhánh hoạt động"
              value={branches.length}
              detail="Cùng một hệ thống quản lý"
              icon={Building2}
            />
            <Metric
              label="Doanh thu toàn chuỗi"
              value={money(total)}
              detail={days === 1 ? "Hôm nay" : `${days} ngày gần nhất`}
              icon={Wallet}
              tone="orange"
            />
            <Metric
              label="Đơn hoàn thành"
              value={num(branches.reduce((s, b) => s + b.paidCount, 0))}
              detail={`${branches.reduce((s, b) => s + b.active, 0)} đơn đang phục vụ`}
              icon={ShoppingBag}
              tone="purple"
            />
            <Metric
              label="Cảnh báo tồn kho"
              value={branches.reduce((s, b) => s + b.low, 0)}
              detail="Số nguyên liệu–chi nhánh cần bổ sung"
              icon={Package}
              tone="blue"
            />
          </div>
          <div className="branch-cards">
            {branches.map((b, index) => (
              <article className="panel branch-card" key={b.id}>
                <div className={`branch-cover cover-${index % 3}`}>
                  <Building2 size={52} strokeWidth={1} />
                  <span>CHI NHÁNH {String(b.id).padStart(2, "0")}</span>
                  <span className="availability available">
                    <i />
                    Đang hoạt động
                  </span>
                </div>
                <div className="branch-card-body">
                  <h2>{b.name}</h2>
                  <p>
                    <MapPin size={15} />
                    {b.address}
                  </p>
                  <p>
                    <Phone size={15} />
                    {b.phone}
                  </p>
                  <div className="branch-numbers">
                    <div>
                      <span>Doanh thu</span>
                      <strong>{money(b.revenue)}</strong>
                    </div>
                    <div>
                      <span>Đơn hoàn thành</span>
                      <strong>{b.paidCount}</strong>
                    </div>
                  </div>
                  <div className="branch-health">
                    <span>
                      <i className="live-dot" />
                      {b.active} đơn mở · {b.tables.length} bàn
                    </span>
                    <span>{b.low} cảnh báo kho</span>
                  </div>
                  <Button
                    variant="secondary"
                    className="full"
                    onClick={() => {
                      switchBranch(b.id);
                      navigate("dashboard");
                    }}
                  >
                    Đến chi nhánh
                    <ArrowUpRight size={17} />
                  </Button>
                </div>
              </article>
            ))}
          </div>
          <div className="chain-analysis">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Doanh thu hợp nhất</h2>
                  <p>Tổng doanh thu tất cả chi nhánh</p>
                </div>
                <span className="soft-tag">{days} ngày</span>
              </div>
              <RevenueChart data={chart} />
            </section>
            <section className="panel branch-ranking">
              <div className="panel-header">
                <div>
                  <h2>Đóng góp theo chi nhánh</h2>
                  <p>Tỷ trọng doanh thu toàn chuỗi</p>
                </div>
              </div>
              {[...branches]
                .sort((a, b) => b.revenue - a.revenue)
                .map((b, i) => (
                  <div className="ranking-row" key={b.id}>
                    <span>0{i + 1}</span>
                    <div>
                      <div>
                        <strong>{b.name.replace("Lá · ", "")}</strong>
                        <b>{((b.revenue / (total || 1)) * 100).toFixed(1)}%</b>
                      </div>
                      <div className="share-bar">
                        <span
                          style={{
                            width: `${(b.revenue / (total || 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <small>{money(b.revenue)}</small>
                    </div>
                  </div>
                ))}
              <button
                className="text-link"
                onClick={() =>
                  downloadCSV(
                    "la-toan-chuoi.csv",
                    [
                      "Chi nhánh",
                      "Doanh thu",
                      "Đơn hoàn thành",
                      "Đơn mở",
                      "Cảnh báo kho",
                    ],
                    branches.map((b) => [
                      b.name,
                      b.revenue,
                      b.paidCount,
                      b.active,
                      b.low,
                    ]),
                  )
                }
              >
                <Download size={16} />
                Xuất báo cáo toàn chuỗi
              </button>
            </section>
          </div>
        </>
      )}
      {modal && (
        <Modal
          title="Mở chi nhánh mới"
          subtitle="Thực đơn và khách hàng dùng chung; bàn và tồn kho quản lý riêng."
          onClose={() => {
            if (!busy) setModal(false);
          }}
        >
          <form onSubmit={submit}>
            <Field label="Tên chi nhánh">
              <input
                name="name"
                required
                maxLength={160}
                placeholder="Lá · Bình Thạnh"
              />
            </Field>
            <Field label="Địa chỉ">
              <input name="address" required maxLength={160} />
            </Field>
            <Field label="Điện thoại">
              <input name="phone" required minLength={8} maxLength={20} />
            </Field>
            <div className="info-box">
              Chi nhánh mới bắt đầu với kho bằng 0 và chưa có bàn. Sau khi tạo,
              chọn chi nhánh để nhập kho, thêm bàn và phân công nhân viên.
            </div>
            <FormError error={formError} />
            <div className="modal-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setModal(false)}
              >
                Hủy
              </Button>
              <Button loading={busy}>Tạo chi nhánh</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

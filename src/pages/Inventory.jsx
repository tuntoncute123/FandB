import React, { useState } from "react";
import {
  Plus,
  Package,
  TriangleAlert,
  ArrowDownToLine,
  ArrowRightLeft,
  History,
  Download,
  Wallet,
} from "lucide-react";
import { useApp } from "../store";
import {
  PageHeading,
  Button,
  SearchBox,
  Metric,
  Modal,
  Field,
  FormError,
  Empty,
  Pagination,
} from "../components/ui";
import { money, num, dateLabel, timeLabel, downloadCSV } from "../lib";
export default function Inventory() {
  const { data, mutate } = useApp();
  const [query, setQuery] = useState(""),
    [onlyLow, setOnlyLow] = useState(false),
    [tab, setTab] = useState("stock"),
    [modal, setModal] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const low = data.ingredients.filter((i) => i.stock <= i.threshold);
  const filtered = data.ingredients.filter(
    (i) =>
      (!onlyLow || i.stock <= i.threshold) &&
      i.name.toLowerCase().includes(query.toLowerCase()),
  );
  function open(type, item) {
    setModal({ type, item });
    setError("");
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.target);
    try {
      if (modal.type === "add")
        await mutate(
          "/ingredients",
          {
            name: f.get("name"),
            unit: f.get("unit"),
            stock: Number(f.get("stock")),
            threshold: Number(f.get("threshold")),
            cost: Number(f.get("cost")),
          },
          "POST",
          "Đã thêm nguyên liệu; tồn đầu kỳ ghi nhận ở chi nhánh hiện tại.",
        );
      else if (modal.type === "transfer")
        await mutate(
          "/stock/transfer",
          {
            ingredientId: Number(f.get("ingredientId")),
            toBranchId: Number(f.get("toBranchId")),
            quantity: Number(f.get("quantity")),
            reason: f.get("reason"),
          },
          "POST",
          "Đã điều chuyển nguyên liệu giữa hai chi nhánh.",
        );
      else
        await mutate(
          "/stock",
          {
            ingredientId: Number(f.get("ingredientId")),
            quantity:
              Number(f.get("quantity")) *
              (f.get("direction") === "out" ? -1 : 1),
            reason: f.get("reason"),
          },
          "POST",
          "Đã cập nhật tồn kho.",
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
        eyebrow="QUẢN LÝ"
        title="Kho nguyên liệu"
        description="Biết rõ tồn kho. Chủ động mỗi ngày."
      >
        <Button variant="secondary" onClick={() => open("transfer")}>
          <ArrowRightLeft size={17} />
          Điều chuyển
        </Button>
        <Button onClick={() => open("stock")}>
          <ArrowDownToLine size={18} />
          Nhập / xuất kho
        </Button>
      </PageHeading>
      <div className="metrics-grid three">
        <Metric
          label="Danh mục nguyên liệu"
          value={data.ingredients.length}
          detail="Dùng chung trong toàn chuỗi"
          icon={Package}
        />
        <Metric
          label="Cần bổ sung"
          value={low.length}
          detail="Tồn kho dưới hoặc bằng ngưỡng"
          icon={TriangleAlert}
          tone="orange"
        />
        <Metric
          label="Giá trị tồn kho"
          value={money(
            data.ingredients.reduce((s, i) => s + i.stock * i.cost, 0),
          )}
          detail="Theo giá vốn tham chiếu"
          icon={Wallet}
          tone="purple"
        />
      </div>
      <div className="panel">
        <div className="tabs">
          <button
            className={tab === "stock" ? "active" : ""}
            onClick={() => setTab("stock")}
          >
            Tồn kho hiện tại
          </button>
          <button
            className={tab === "history" ? "active" : ""}
            onClick={() => setTab("history")}
          >
            Lịch sử xuất nhập
          </button>
        </div>
        {tab === "stock" ? (
          <>
            <div className="table-toolbar">
              <SearchBox
                value={query}
                onChange={setQuery}
                placeholder="Tìm nguyên liệu..."
              />
              <div className="toolbar-actions">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={onlyLow}
                    onChange={(e) => setOnlyLow(e.target.checked)}
                  />
                  Chỉ hiện sắp hết
                </label>
                <Button variant="secondary" onClick={() => open("add")}>
                  <Plus size={16} />
                  Nguyên liệu
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    downloadCSV(
                      "la-ton-kho.csv",
                      [
                        "Nguyên liệu",
                        "Đơn vị",
                        "Tồn kho",
                        "Ngưỡng cảnh báo",
                        "Giá vốn",
                      ],
                      filtered.map((i) => [
                        i.name,
                        i.unit,
                        i.stock,
                        i.threshold,
                        i.cost,
                      ]),
                    )
                  }
                >
                  <Download size={17} />
                  <span>Xuất CSV</span>
                </Button>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Nguyên liệu</th>
                    <th>Tồn hiện tại</th>
                    <th>Ngưỡng tối thiểu</th>
                    <th>Giá vốn / đơn vị</th>
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <div className="ingredient-name">
                          <span>
                            <Package size={18} />
                          </span>
                          <strong>{i.name}</strong>
                        </div>
                      </td>
                      <td className="strong">
                        {num(i.stock)} <span className="muted">{i.unit}</span>
                      </td>
                      <td>
                        {num(i.threshold)} {i.unit}
                      </td>
                      <td>{money(i.cost)}</td>
                      <td>
                        <span
                          className={`badge ${i.stock <= 0 ? "status-cancelled" : i.stock <= i.threshold ? "status-pending" : "status-completed"}`}
                        >
                          <i />
                          {i.stock <= 0
                            ? "Hết hàng"
                            : i.stock <= i.threshold
                              ? "Sắp hết"
                              : "Đủ hàng"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="text-link"
                          onClick={() => open("stock", i)}
                        >
                          Cập nhật <ArrowDownToLine size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && <Empty title="Không có nguyên liệu phù hợp" />}
          </>
        ) : (
          <>
            <div className="table-toolbar">
              <p className="muted">100 giao dịch gần nhất tại chi nhánh này</p>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Nguyên liệu</th>
                    <th>Thay đổi</th>
                    <th>Lý do</th>
                    <th>Nhân viên</th>
                  </tr>
                </thead>
                <tbody>
                  {data.movements.map((m) => (
                    <tr key={m.id}>
                      <td>
                        {dateLabel(m.createdAt)}
                        <small className="cell-sub">
                          {timeLabel(m.createdAt)}
                        </small>
                      </td>
                      <td className="strong">{m.name}</td>
                      <td
                        className={
                          m.quantity > 0 ? "text-green" : "text-danger"
                        }
                      >
                        {m.quantity > 0 ? "+" : ""}
                        {num(m.quantity)} {m.unit}
                      </td>
                      <td>{m.reason}</td>
                      <td>{m.staffName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.movements.length && (
              <Empty
                title="Chưa có giao dịch kho"
                description="Nhập kho, tạo đơn hoặc điều chuyển để bắt đầu ghi nhận."
              />
            )}
          </>
        )}
      </div>
      {modal && (
        <Modal
          title={
            modal.type === "add"
              ? "Thêm nguyên liệu"
              : modal.type === "transfer"
                ? "Điều chuyển giữa chi nhánh"
                : "Nhập / xuất nguyên liệu"
          }
          subtitle={data.branches.find((b) => b.id === data.branchId)?.name}
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          <form onSubmit={submit}>
            {modal.type === "add" ? (
              <>
                <Field label="Tên nguyên liệu">
                  <input name="name" required maxLength={160} />
                </Field>
                <div className="form-grid">
                  <Field label="Đơn vị tính">
                    <select name="unit">
                      {["kg", "lít", "cái", "quả", "gói", "chai"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Giá vốn / đơn vị (₫)">
                    <input
                      name="cost"
                      type="number"
                      min="0"
                      max="1000000000"
                      step="1"
                      required
                    />
                  </Field>
                  <Field label="Tồn đầu kỳ chi nhánh này">
                    <input
                      name="stock"
                      type="number"
                      min="0"
                      max="1000000"
                      step="any"
                      required
                      defaultValue="0"
                    />
                  </Field>
                  <Field label="Ngưỡng cảnh báo">
                    <input
                      name="threshold"
                      type="number"
                      min="0"
                      max="1000000"
                      step="any"
                      required
                      defaultValue="1"
                    />
                  </Field>
                </div>
              </>
            ) : (
              <>
                <Field label="Nguyên liệu">
                  <select
                    name="ingredientId"
                    required
                    defaultValue={modal.item?.id || ""}
                  >
                    <option value="">Chọn nguyên liệu</option>
                    {data.ingredients.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} · Còn {num(i.stock)} {i.unit}
                      </option>
                    ))}
                  </select>
                </Field>
                {modal.type === "transfer" ? (
                  <Field label="Chi nhánh nhận">
                    <select name="toBranchId" required defaultValue="">
                      <option value="">Chọn chi nhánh nhận</option>
                      {data.branches
                        .filter((b) => b.id !== data.branchId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="Loại giao dịch">
                    <select name="direction">
                      <option value="in">Nhập kho (+)</option>
                      <option value="out">Xuất kho / hao hụt (−)</option>
                    </select>
                  </Field>
                )}
                <Field label="Số lượng theo đơn vị nguyên liệu">
                  <input
                    name="quantity"
                    type="number"
                    min="0.000001"
                    max="1000000"
                    step="any"
                    required
                  />
                </Field>
                <Field label="Lý do / ghi chú">
                  <textarea
                    name="reason"
                    required
                    minLength={3}
                    maxLength={500}
                    rows="2"
                    placeholder="VD: Nhập từ nhà cung cấp, bổ sung ca sáng..."
                  />
                </Field>
                {modal.type === "transfer" && (
                  <div className="info-box">
                    Số lượng sẽ được trừ tại chi nhánh hiện tại và cộng tại chi
                    nhánh nhận trong cùng một giao dịch.
                  </div>
                )}
              </>
            )}
            <FormError error={error} />
            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModal(null)}
              >
                Hủy
              </Button>
              <Button loading={busy}>
                {modal.type === "transfer"
                  ? "Xác nhận điều chuyển"
                  : "Lưu giao dịch"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

import React, { useEffect, useState } from "react";
import {
  ShoppingBag,
  Coffee,
  Leaf,
  UtensilsCrossed,
  Croissant,
  Plus,
  Minus,
  Trash2,
  Send,
  StickyNote,
  User,
  Check,
  Package,
  Truck,
} from "lucide-react";
import { useApp } from "../store";
import {
  Button,
  PageHeading,
  SearchBox,
  ProductImage,
  Empty,
  Field,
  FormError,
  IconButton,
  Modal,
} from "../components/ui";
import { money, categories, activeOrders, newRequestKey } from "../lib";
import { OrderDetail } from "./Orders";
const categoryIcons = [Coffee, Leaf, UtensilsCrossed, Croissant];
export default function POS() {
  const { data, mutate, posTable, setPosTable, branchId } = useApp();
  const draftKey = `la-cart-${branchId}`;
  const [draft] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(draftKey)) || {};
    } catch {
      return {};
    }
  });
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("Tất cả"),
    [cart, setCart] = useState(draft.cart || []),
    [requestKey, setRequestKey] = useState(draft.requestKey || newRequestKey()),
    [type, setType] = useState(posTable ? "dinein" : draft.type || "dinein"),
    [tableId, setTableId] = useState(posTable || draft.tableId || ""),
    [customerId, setCustomerId] = useState(draft.customerId || ""),
    [note, setNote] = useState(draft.note || ""),
    [discount, setDiscount] = useState(draft.discount || 0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(null),
    [clear, setClear] = useState(false);
  useEffect(() => {
    setPosTable(null);
  }, []);
  useEffect(() => {
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        cart,
        type,
        tableId,
        customerId,
        note,
        discount,
        requestKey,
      }),
    );
  }, [cart, type, tableId, customerId, note, discount, draftKey, requestKey]);
  const products = data.products.filter(
    (p) =>
      p.available &&
      (category === "Tất cả" || p.category === category) &&
      p.name.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")),
  );
  const items = cart
    .map((i) => ({
      ...data.products.find((p) => p.id === i.productId),
      quantity: i.quantity,
    }))
    .filter((i) => i.id);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = Math.round(
    (Math.max(0, subtotal - Number(discount)) * data.settings.tax) / 100,
  );
  const total = subtotal - Number(discount) + tax;
  const active = activeOrders(data.orders);
  const availableTables = data.tables.filter(
    (t) => !active.some((o) => o.tableId === t.id),
  );
  function add(id, delta = 1) {
    setCart((old) => {
      const existing = old.find((i) => i.productId === id);
      if (existing)
        return old
          .map((i) =>
            i.productId === id
              ? { ...i, quantity: Math.min(100, i.quantity + delta) }
              : i,
          )
          .filter((i) => i.quantity > 0);
      return [...old, { productId: id, quantity: 1 }];
    });
    setError("");
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await mutate(
        "/orders",
        {
          type,
          tableId: type === "dinein" ? Number(tableId) : null,
          customerId: customerId ? Number(customerId) : null,
          discount: Number(discount),
          note,
          items: cart,
          requestKey,
        },
        "POST",
        "Đã tạo đơn và gửi đến bếp.",
      );
      setCart([]);
      setRequestKey(newRequestKey());
      setNote("");
      setDiscount(0);
      setTableId("");
      setCustomerId("");
      setSelected(result.id);
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
        title="Bán hàng POS"
        description="Chọn món yêu thích. Phần còn lại, để Lá lo."
      >
        <span className="soft-tag">
          <span className="live-dot" />
          {data.products.filter((p) => p.available).length} món đang phục vụ
        </span>
      </PageHeading>
      <div className="pos-layout">
        <section className="pos-catalog">
          <div className="catalog-toolbar">
            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Tìm tên món trong thực đơn..."
            />
            <span>{products.length} món</span>
          </div>
          <div className="category-tabs">
            <button
              className={category === "Tất cả" ? "active" : ""}
              onClick={() => setCategory("Tất cả")}
            >
              <ShoppingBag size={18} />
              Tất cả
            </button>
            {categories.map((c, i) => {
              const Icon = categoryIcons[i];
              return (
                <button
                  key={c}
                  className={category === c ? "active" : ""}
                  onClick={() => setCategory(c)}
                >
                  <Icon size={18} />
                  {c}
                </button>
              );
            })}
          </div>
          <div className="product-grid">
            {products.map((p) => {
              const qty = cart.find((i) => i.productId === p.id)?.quantity;
              const soldOut = data.recipes
                .filter((r) => r.productId === p.id)
                .some(
                  (r) =>
                    (data.ingredients.find((i) => i.id === r.ingredientId)
                      ?.stock || 0) < r.quantity,
                );
              return (
                <button
                  key={p.id}
                  className={`product-card ${qty ? "in-cart" : ""}`}
                  onClick={() => add(p.id)}
                  disabled={soldOut}
                  aria-label={`Thêm ${p.name}`}
                >
                  <div className="product-photo">
                    <ProductImage product={p} />
                    {qty && (
                      <span className="product-quantity">{qty} trong đơn</span>
                    )}
                    {soldOut && (
                      <span className="sold-out">Hết nguyên liệu</span>
                    )}
                  </div>
                  <div className="product-card-body">
                    <span className="product-category">{p.category}</span>
                    <h3>{p.name}</h3>
                    <div>
                      <strong>{money(p.price)}</strong>
                      <span className="add-product">
                        <Plus size={18} />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {!products.length && (
            <Empty
              title="Chưa tìm thấy món"
              description="Thử từ khóa hoặc nhóm món khác."
            />
          )}
        </section>
        <form className="pos-cart panel" onSubmit={submit}>
          <div className="cart-heading">
            <h2>
              Đơn hàng mới{" "}
              <span className="count-bubble">
                {items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            </h2>
            <IconButton
              label="Xóa giỏ hàng"
              type="button"
              disabled={!cart.length}
              onClick={() => setClear(true)}
            >
              <Trash2 size={18} />
            </IconButton>
          </div>
          <div className="segmented order-types">
            {[
              ["dinein", "Tại bàn", UtensilsCrossed],
              ["takeaway", "Mang đi", ShoppingBag],
              ["delivery", "Giao hàng", Truck],
            ].map(([key, label, Icon]) => (
              <button
                type="button"
                key={key}
                className={type === key ? "selected" : ""}
                onClick={() => setType(key)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
          <div className="cart-fields">
            {type === "dinein" && (
              <Field label="Bàn phục vụ">
                <select
                  required
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                >
                  <option value="">Chọn bàn</option>
                  {availableTables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {t.zone}
                      {t.reserved ? " (Đã đặt)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Khách hàng">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Khách lẻ</option>
                {data.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.phone}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {type === "delivery" && (
            <p className="info-box">
              Ghi tên, số điện thoại và địa chỉ giao hàng vào ghi chú đơn.
            </p>
          )}
          <div className="cart-items">
            {items.length ? (
              items.map((i) => (
                <div className="cart-item" key={i.id}>
                  <ProductImage product={i} />
                  <div className="cart-item-main">
                    <strong>{i.name}</strong>
                    <small>{money(i.price)}</small>
                    <div className="quantity-control">
                      <button
                        type="button"
                        aria-label={`Giảm ${i.name}`}
                        onClick={() => add(i.id, -1)}
                      >
                        <Minus size={13} />
                      </button>
                      <span>{i.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Tăng ${i.name}`}
                        disabled={i.quantity >= 100}
                        onClick={() => add(i.id)}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                  <b>{money(i.price * i.quantity)}</b>
                </div>
              ))
            ) : (
              <div className="cart-empty">
                <ShoppingBag size={35} />
                <strong>Một đơn ngon đang chờ</strong>
                <p>Chạm vào món bên trái để bắt đầu.</p>
              </div>
            )}
          </div>
          <div className="cart-bottom">
            <label className="note-input">
              <StickyNote size={16} />
              <input
                aria-label="Ghi chú đơn hàng"
                placeholder="Ghi chú: ít đá, không hành..."
                value={note}
                maxLength={1000}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <div className="totals">
              <div>
                <span>Tạm tính</span>
                <span>{money(subtotal)}</span>
              </div>
              <div>
                <label htmlFor="discount">Giảm giá (₫)</label>
                <input
                  id="discount"
                  type="number"
                  min="0"
                  max={subtotal}
                  step="1"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div>
                <span>Thuế ({data.settings.tax}%)</span>
                <span>{money(tax)}</span>
              </div>
              <div className="grand-total">
                <span>Tổng cộng</span>
                <strong>{money(total)}</strong>
              </div>
            </div>
            <FormError error={error} />
            <Button
              loading={busy}
              className="full"
              type="submit"
              disabled={!cart.length}
            >
              <Send size={17} />
              Tạo đơn & gửi bếp
            </Button>
            <p className="cart-footnote">
              Đơn nháp được lưu tự động trên thiết bị này.
            </p>
          </div>
        </form>
      </div>
      {selected && (
        <OrderDetail id={selected} onClose={() => setSelected(null)} />
      )}{" "}
      {clear && (
        <Modal title="Xóa món trong đơn nháp?" onClose={() => setClear(false)}>
          <p>Thao tác này chỉ xóa các món chưa gửi bếp.</p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setClear(false)}>
              Giữ lại
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setCart([]);
                setRequestKey(newRequestKey());
                setDiscount(0);
                setClear(false);
              }}
            >
              Xóa giỏ hàng
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

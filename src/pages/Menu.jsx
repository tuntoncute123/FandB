import React, { useState } from "react";
import {
  Plus,
  Pencil,
  UtensilsCrossed,
  Trash2,
  Leaf,
  Search,
} from "lucide-react";
import { useApp } from "../store";
import {
  PageHeading,
  Button,
  SearchBox,
  ProductImage,
  Modal,
  Field,
  FormError,
  Empty,
  IconButton,
} from "../components/ui";
import { money, categories } from "../lib";
export default function MenuPage() {
  const { data, mutate } = useApp();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("Tất cả"),
    [modal, setModal] = useState(null),
    [recipe, setRecipe] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const products = data.products.filter(
    (p) =>
      (category === "Tất cả" || p.category === category) &&
      p.name.toLowerCase().includes(query.toLowerCase()),
  );
  function edit(product) {
    setModal(product);
    setRecipe(
      product.id
        ? data.recipes
            .filter((r) => r.productId === product.id)
            .map((r) => ({
              ingredientId: r.ingredientId,
              quantity: r.quantity,
            }))
        : [],
    );
    setError("");
  }
  async function save(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    setBusy(true);
    setError("");
    try {
      await mutate(
        `/products${modal.id ? "/" + modal.id : ""}`,
        {
          name: f.get("name"),
          category: f.get("category"),
          price: Number(f.get("price")),
          cost: Number(f.get("cost")),
          description: f.get("description"),
          image: f.get("image"),
          available: f.get("available") === "on",
          recipe: recipe.map((r) => ({
            ingredientId: Number(r.ingredientId),
            quantity: Number(r.quantity),
          })),
        },
        modal.id ? "PUT" : "POST",
        "Đã lưu món trong thực đơn toàn chuỗi.",
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
        title="Thực đơn"
        description="Một thực đơn nhất quán, tại mọi chi nhánh."
      >
        <Button onClick={() => edit({ available: 1, category: categories[0] })}>
          <Plus size={18} />
          Thêm món mới
        </Button>
      </PageHeading>
      <div className="menu-top">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Tìm tên món..."
        />
        <span className="muted">
          {data.products.filter((p) => p.available).length} đang bán ·{" "}
          {data.products.filter((p) => !p.available).length} tạm ngưng
        </span>
      </div>
      <div className="category-tabs">
        {["Tất cả", ...categories].map((c) => (
          <button
            className={c === category ? "active" : ""}
            key={c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="menu-grid">
        {products.map((p) => (
          <article
            className={`menu-card ${!p.available ? "unavailable" : ""}`}
            key={p.id}
          >
            <div className="menu-card-photo">
              <ProductImage product={p} />
              <span
                className={`availability ${p.available ? "available" : ""}`}
              >
                <i />
                {p.available ? "Đang bán" : "Tạm ngưng"}
              </span>
            </div>
            <div className="menu-card-info">
              <span className="product-category">{p.category}</span>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <div className="menu-card-price">
                <strong>{money(p.price)}</strong>
                <button
                  className="icon-btn"
                  aria-label={`Sửa ${p.name}`}
                  onClick={() => edit(p)}
                >
                  <Pencil size={17} />
                </button>
              </div>
              <div className="menu-card-meta">
                <span>Giá vốn {money(p.cost)}</span>
                <span>
                  {data.recipes.filter((r) => r.productId === p.id).length}{" "}
                  nguyên liệu
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!products.length && <Empty title="Không tìm thấy món" />}
      {modal && (
        <Modal
          wide
          title={modal.id ? "Chỉnh sửa món" : "Thêm món mới"}
          subtitle="Thực đơn và định lượng áp dụng cho toàn chuỗi."
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="Tên món">
                <input
                  name="name"
                  required
                  maxLength={160}
                  defaultValue={modal.name}
                />
              </Field>
              <Field label="Danh mục">
                <select name="category" defaultValue={modal.category}>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Giá bán (₫)">
                <input
                  name="price"
                  required
                  type="number"
                  min="0"
                  max="1000000000"
                  step="1"
                  defaultValue={modal.price}
                />
              </Field>
              <Field label="Giá vốn ước tính (₫)">
                <input
                  name="cost"
                  required
                  type="number"
                  min="0"
                  max="1000000000"
                  step="1"
                  defaultValue={modal.cost}
                />
              </Field>
            </div>
            <Field label="Mô tả">
              <textarea
                name="description"
                maxLength={1000}
                rows="2"
                defaultValue={modal.description}
              />
            </Field>
            <Field
              label="Đường dẫn ảnh"
              hint="Ảnh HTTPS hoặc đường dẫn /images/. Để trống dùng ảnh mặc định."
            >
              <input name="image" maxLength={500} defaultValue={modal.image} />
            </Field>
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="available"
                defaultChecked={!!modal.available}
              />
              Đang phục vụ món này
            </label>
            <div className="recipe-heading">
              <div>
                <h3>Định lượng nguyên liệu</h3>
                <p>Tự động trừ kho theo số lượng món khi tạo đơn.</p>
              </div>
              <Button
                variant="secondary"
                type="button"
                onClick={() =>
                  setRecipe([...recipe, { ingredientId: "", quantity: 1 }])
                }
              >
                <Plus size={16} />
                Thêm
              </Button>
            </div>
            {!recipe.length && (
              <div className="info-box">
                Món chưa có định lượng sẽ không tự trừ nguyên liệu. Bạn có thể
                thêm công thức tại đây.
              </div>
            )}
            {recipe.map((r, index) => (
              <div className="recipe-row" key={index}>
                <select
                  required
                  aria-label={`Nguyên liệu ${index + 1}`}
                  value={r.ingredientId}
                  onChange={(e) =>
                    setRecipe(
                      recipe.map((r, i) =>
                        i === index
                          ? { ...r, ingredientId: Number(e.target.value) }
                          : r,
                      ),
                    )
                  }
                >
                  <option value="">Chọn nguyên liệu</option>
                  {data.ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Định lượng ${index + 1}`}
                  required
                  type="number"
                  min="0.000001"
                  max="10000"
                  step="any"
                  value={r.quantity}
                  onChange={(e) =>
                    setRecipe(
                      recipe.map((r, i) =>
                        i === index ? { ...r, quantity: e.target.value } : r,
                      ),
                    )
                  }
                />
                <IconButton
                  label="Xóa nguyên liệu khỏi công thức"
                  type="button"
                  onClick={() =>
                    setRecipe(recipe.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 size={17} />
                </IconButton>
              </div>
            ))}
            <FormError error={error} />
            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModal(null)}
              >
                Hủy
              </Button>
              <Button loading={busy}>Lưu món</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

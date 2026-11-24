import React, { useEffect, useRef, useId } from "react";
import {
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
  ArrowUpRight,
} from "lucide-react";
import { statusLabels } from "../lib";
export function Button({
  children,
  variant = "primary",
  className = "",
  loading = false,
  ...props
}) {
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      {...props}
      disabled={loading || props.disabled}
    >
      {loading ? <LoaderCircle size={18} className="spin" /> : null}
      {children}
    </button>
  );
}
export function IconButton({ children, label, ...props }) {
  return (
    <button className="icon-btn" title={label} aria-label={label} {...props}>
      {children}
    </button>
  );
}
export function PageHeading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Tìm kiếm...",
  ...props
}) {
  return (
    <label className="search-box">
      <Search size={18} />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Xóa tìm kiếm"
        >
          <X size={16} />
        </button>
      )}
    </label>
  );
}
export function Status({ status }) {
  return (
    <span className={`badge status-${status}`}>
      <i />
      {statusLabels[status] || status}
    </span>
  );
}
export function Empty({
  title = "Chưa có dữ liệu",
  description = "Dữ liệu sẽ xuất hiện tại đây khi bạn bắt đầu.",
  children,
}) {
  return (
    <div className="empty">
      <div>
        <Inbox size={30} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Modal({ title, subtitle, children, onClose, wide = false }) {
  const ref = useRef(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const handle = (e) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const items = [
          ...ref.current.querySelectorAll(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ),
        ].filter((el) => el.offsetParent !== null);
        const first = items[0],
          last = items.at(-1);
        // A completed async action may replace the focused button. Keep the next
        // Tab inside the dialog even when the browser falls back to body focus.
        if (!ref.current.contains(document.activeElement)) {
          e.preventDefault();
          (e.shiftKey ? last : first)?.focus();
          return;
        }

        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton label="Đóng" onClick={onClose}>
            <X size={21} />
          </IconButton>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Field({ label, error, children, hint }) {
  const id = useId();
  let assigned = false;
  function associate(nodes) {
    return React.Children.map(nodes, (child) => {
      if (!React.isValidElement(child)) return child;
      if (!assigned && ["input", "select", "textarea"].includes(child.type)) {
        assigned = true;
        return React.cloneElement(child, {
          id,
          "aria-describedby": hint ? `${id}-hint` : undefined,
          "aria-invalid": error ? true : undefined,
        });
      }
      return child.props.children
        ? React.cloneElement(child, {}, associate(child.props.children))
        : child;
    });
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {associate(children)}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && <small className="error-text">{error}</small>}
    </div>
  );
}
export function FormError({ error }) {
  return error ? (
    <div className="form-error" role="alert">
      {error}
    </div>
  ) : null;
}
export function Pagination({ page, setPage, total, size = 10 }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="pagination">
      <span>
        {total
          ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} trong ${total}`
          : "0 kết quả"}
      </span>
      <div>
        <IconButton
          label="Trang trước"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft size={17} />
        </IconButton>
        <span>
          Trang {page} / {pages}
        </span>
        <IconButton
          label="Trang sau"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight size={17} />
        </IconButton>
      </div>
    </div>
  );
}
export function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "green",
  trend,
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span>{label}</span>
        {Icon && (
          <div className={`metric-icon ${tone}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
      <strong>{value}</strong>
      <div className="metric-foot">
        {trend && (
          <span className="trend">
            <ArrowUpRight size={14} />
            {trend}
          </span>
        )}
        <span>{detail}</span>
      </div>
    </div>
  );
}
export function Avatar({ name, className = "" }) {
  return (
    <span className={`avatar ${className}`}>
      {name
        ?.split(" ")
        .slice(-2)
        .map((w) => w[0])
        .join("")}
    </span>
  );
}
export function ProductImage({ product, className = "" }) {
  return (
    <div className={`product-image ${className}`}>
      <img
        src={product.image || "/images/latte.jpg"}
        alt={product.name}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = "/images/latte.jpg";
        }}
      />
    </div>
  );
}

import React, { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  ClipboardList,
  ChefHat,
  Package,
  Users,
  UserRoundCog,
  ChartNoAxesCombined,
  Settings,
  Leaf,
  ChevronDown,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
  ArrowUpRight,
  Building2,
  HelpCircle,
  Command,
  Check,
  WifiOff,
} from "lucide-react";
import { useApp } from "./store";
import { Avatar, IconButton, Modal, SearchBox, Button } from "./components/ui";
import { activeOrders, roleLabels } from "./lib";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Orders from "./pages/Orders";
import Tables from "./pages/Tables";
import Kitchen from "./pages/Kitchen";
import MenuPage from "./pages/Menu";
import Inventory from "./pages/Inventory";
import Customers from "./pages/Customers";
import Staff from "./pages/Staff";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import Branches from "./pages/Branches";
const navigation = [
  {
    section: "TỔNG QUAN",
    items: [
      ["dashboard", "Tổng quan", LayoutDashboard],
      ["branches", "Quản lý chuỗi", Building2, "admin"],
    ],
  },
  {
    section: "VẬN HÀNH",
    items: [
      ["pos", "Bán hàng POS", ShoppingBag, "sales"],
      ["tables", "Sơ đồ bàn", UtensilsCrossed, "sales"],
      ["orders", "Đơn hàng", ClipboardList, "sales"],
      ["kitchen", "Màn hình bếp", ChefHat],
    ],
  },
  {
    section: "QUẢN LÝ",
    items: [
      ["menu", "Thực đơn", UtensilsCrossed, "admin"],
      ["inventory", "Kho nguyên liệu", Package, "admin"],
      ["customers", "Khách hàng", Users, "sales"],
      ["staff", "Nhân viên", UserRoundCog, "admin"],
      ["reports", "Báo cáo", ChartNoAxesCombined, "admin"],
    ],
  },
];
const pages = {
  dashboard: Dashboard,
  branches: Branches,
  pos: POS,
  tables: Tables,
  orders: Orders,
  kitchen: Kitchen,
  menu: MenuPage,
  inventory: Inventory,
  customers: Customers,
  staff: Staff,
  reports: Reports,
  settings: SettingsPage,
};
export default function App() {
  const {
    data,
    loading,
    auth,
    error,
    toast,
    logout,
    page,
    navigate,
    branchId,
    switchBranch,
    notify,
    refresh,
    offline,
  } = useApp();
  const [sidebar, setSidebar] = useState(false),
    [modal, setModal] = useState(null),
    [query, setQuery] = useState("");
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setModal("search");
      }
      if (e.key === "Escape") setSidebar(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  if (loading && !data)
    return (
      <div className="loading-screen">
        <div className="brand-mark">
          <Leaf className="pulse" size={30} />
        </div>
        <h2>Chào bạn, Lá đang chuẩn bị...</h2>
        <p>Kết nối không gian quản lý của bạn</p>
      </div>
    );
  if (!auth) return <Login />;
  if (!data)
    return (
      <div className="fatal-error">
        <h2>Chưa tải được dữ liệu</h2>
        <p>{error}</p>
        <Button onClick={() => refresh()}>Thử lại</Button>
      </div>
    );
  const allowed = (tag) =>
    !tag ||
    (tag === "admin" && data.user.role === "admin") ||
    (tag === "sales" && data.user.role !== "kitchen");
  const links = navigation.flatMap((g) => g.items).filter((i) => allowed(i[3]));
  if (data.user.role === "admin") links.push(["settings", "Cài đặt", Settings]);
  const current = links.find((i) => i[0] === page);
  const Page = current
    ? pages[page]
    : data.user.role === "kitchen"
      ? Kitchen
      : Dashboard;
  const go = (p) => {
    navigate(p);
    setSidebar(false);
    setModal(null);
    setQuery("");
  };
  const low = data.ingredients.filter((i) => i.stock <= i.threshold),
    pending = activeOrders(data.orders).filter((o) => o.status === "pending");
  return (
    <div className="app-shell">
      {sidebar && (
        <div className="sidebar-scrim" onClick={() => setSidebar(false)} />
      )}
      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <a
          className="brand"
          href="#dashboard"
          onClick={() => setSidebar(false)}
        >
          <span className="brand-mark">
            <Leaf size={25} />
          </span>
          <span>
            lá<span className="brand-suffix">F&B</span>
          </span>
          <span className="brand-tag">WORKSPACE</span>
        </a>
        <div className="workspace-label">
          <span className="workspace-icon">
            <UtensilsCrossed size={18} />
          </span>
          <div>
            <strong>Lá Coffee & Kitchen</strong>
            <small>Chuỗi nhà hàng & cà phê</small>
          </div>
        </div>
        <nav aria-label="Điều hướng chính">
          {navigation.map((group) => (
            <div className="nav-group" key={group.section}>
              {group.items.some((i) => allowed(i[3])) && (
                <span className="nav-label">{group.section}</span>
              )}
              {group.items
                .filter((i) => allowed(i[3]))
                .map(([key, label, Icon]) => (
                  <button
                    key={key}
                    onClick={() => go(key)}
                    className={`nav-link ${page === key ? "active" : ""}`}
                    aria-current={page === key ? "page" : undefined}
                  >
                    <Icon size={19} />
                    <span>{label}</span>
                    {key === "orders" &&
                      activeOrders(data.orders).length > 0 && (
                        <small>{activeOrders(data.orders).length}</small>
                      )}
                    {key === "pos" && <span className="shortcut">↗</span>}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="support-card">
            <span className="support-icon">
              <Leaf size={18} />
            </span>
            <strong>Một ngày vận hành nhẹ nhàng</strong>
            <p>Mọi thứ bạn cần, ngay tại Lá.</p>
            <button onClick={() => setModal("help")}>
              Hướng dẫn sử dụng <ArrowUpRight size={15} />
            </button>
          </div>
          {data.user.role === "admin" && (
            <button
              className={`nav-link ${page === "settings" ? "active" : ""}`}
              onClick={() => go("settings")}
            >
              <Settings size={19} />
              Cài đặt hệ thống
            </button>
          )}
          <div className="sidebar-user">
            <Avatar name={data.user.name} />
            <div>
              <strong>{data.user.name}</strong>
              <small>{roleLabels[data.user.role]}</small>
            </div>
            <IconButton label="Đăng xuất" onClick={() => setModal("logout")}>
              <LogOut size={17} />
            </IconButton>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <IconButton label="Mở menu" onClick={() => setSidebar(!sidebar)}>
              <Menu size={21} />
            </IconButton>
            <span className="breadcrumb">
              Không gian làm việc <span>/</span>{" "}
              <strong>{current?.[1] || "Tổng quan"}</strong>
            </span>
          </div>
          <div className="topbar-actions">
            <div className="branch-select">
              <Building2 size={17} />
              <select
                aria-label="Chọn chi nhánh"
                value={branchId}
                onChange={(e) => switchBranch(Number(e.target.value))}
              >
                {data.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>
            <span className="topbar-divider" />
            <IconButton
              label="Tìm nhanh chức năng"
              onClick={() => setModal("search")}
            >
              <Search size={20} />
            </IconButton>
            <button
              className="icon-btn notification-btn"
              aria-label="Thông báo"
              onClick={() => setModal("notifications")}
            >
              <Bell size={20} />
              {low.length + pending.length > 0 && <i />}
            </button>
            <Avatar name={data.user.name} />
          </div>
        </header>
        {offline && (
          <div className="offline-banner">
            <WifiOff size={17} /> Mất kết nối cập nhật. Dữ liệu đang hiển thị là
            lần đồng bộ gần nhất.{" "}
            <button onClick={() => refresh()}>Thử lại</button>
          </div>
        )}
        <main
          className={`main-content page-${page}`}
          key={`${page}-${branchId}`}
        >
          <Page />
        </main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} Lá F&B</span>
          <span>
            <i className="live-dot" />{" "}
            {offline ? "Đang kết nối lại" : "Hệ thống đang hoạt động"} <b>·</b>{" "}
            Giờ Việt Nam
          </span>
        </footer>
      </div>
      {toast && (
        <div key={toast.id} className={`toast ${toast.type}`} role="status">
          {toast.type === "success" ? (
            <Check size={19} />
          ) : (
            <HelpCircle size={19} />
          )}
          <span>{toast.message}</span>
        </div>
      )}
      {modal === "search" && (
        <Modal
          title="Bạn muốn làm gì?"
          subtitle="Di chuyển nhanh giữa các chức năng · Ctrl K"
          onClose={() => setModal(null)}
        >
          <SearchBox
            autoFocus
            value={query}
            onChange={setQuery}
            placeholder="Tìm chức năng..."
          />
          <div className="command-results">
            {links
              .filter((i) =>
                i[1]
                  .toLocaleLowerCase("vi")
                  .includes(query.toLocaleLowerCase("vi")),
              )
              .map(([key, label, Icon]) => (
                <button key={key} onClick={() => go(key)}>
                  <Icon size={20} />
                  {label}
                  <ArrowUpRight size={17} />
                </button>
              ))}
          </div>
        </Modal>
      )}
      {modal === "notifications" && (
        <Modal
          title="Nhịp vận hành"
          subtitle="Thông báo từ chi nhánh đang chọn"
          onClose={() => setModal(null)}
        >
          <div className="notice-list">
            {pending.length > 0 && (
              <button onClick={() => go("kitchen")}>
                <ChefHat />
                <div>
                  <strong>{pending.length} đơn đang chờ xác nhận</strong>
                  <p>Chuyển đến màn hình bếp để bắt đầu chế biến.</p>
                </div>
                <ArrowUpRight size={18} />
              </button>
            )}
            {data.user.role === "admin" &&
              low.map((i) => (
                <button key={i.id} onClick={() => go("inventory")}>
                  <Package />
                  <div>
                    <strong>{i.name} sắp hết</strong>
                    <p>
                      Còn {Number(i.stock.toFixed(2))} {i.unit} · Ngưỡng{" "}
                      {i.threshold} {i.unit}
                    </p>
                  </div>
                  <ArrowUpRight size={18} />
                </button>
              ))}
            {!pending.length && (!low.length || data.user.role !== "admin") && (
              <p>Mọi thứ đã được xử lý. Chúc bạn một ca làm việc tốt!</p>
            )}
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal
          title="Một vòng quanh Lá"
          subtitle="Luồng vận hành dành cho chuỗi F&B"
          onClose={() => setModal(null)}
        >
          <div className="help-steps">
            {[
              [
                "01",
                "Chọn chi nhánh",
                "Dùng bộ chọn ở góc trên. Đơn hàng, bàn và kho luôn thuộc chi nhánh hiện tại.",
              ],
              [
                "02",
                "Tạo đơn tại POS",
                "Chọn hình thức phục vụ, chọn bàn, thêm món và gửi đơn xuống bếp.",
              ],
              [
                "03",
                "Theo dõi bếp",
                "Chuyển đơn qua Chờ xác nhận → Đang chế biến → Sẵn sàng.",
              ],
              [
                "04",
                "Thanh toán đơn hàng",
                "Mở đơn đã sẵn sàng, chọn phương thức và ghi nhận thanh toán. Có thể in phiếu bán hàng.",
              ],
              [
                "05",
                "Quản lý toàn chuỗi",
                "Xem so sánh doanh thu, mở chi nhánh, phân công nhân viên và điều chuyển kho.",
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span>{n}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="info-box">
            Chuyển khoản và thẻ là ghi nhận thủ công. Chưa kết nối cổng thanh
            toán hay dịch vụ hóa đơn điện tử.
          </div>
        </Modal>
      )}
      {modal === "logout" && (
        <Modal title="Đăng xuất khỏi Lá?" onClose={() => setModal(null)}>
          <p>Các thay đổi đã lưu được giữ nguyên trên máy chủ.</p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setModal(null)}>
              Ở lại
            </Button>
            <Button
              onClick={async () => {
                try {
                  await logout();
                  setModal(null);
                } catch (e) {
                  notify(e.message, "error");
                }
              }}
            >
              Đăng xuất
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

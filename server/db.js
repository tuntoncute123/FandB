import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import bcrypt from "bcryptjs";

export const databasePath =
  process.env.DB_PATH || resolve("data/la-fnb.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });
export const db = new DatabaseSync(databasePath);
db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS branches (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, address TEXT NOT NULL, phone TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS branch_stock (branchId INTEGER NOT NULL REFERENCES branches(id), ingredientId INTEGER NOT NULL, stock REAL NOT NULL, threshold REAL NOT NULL, PRIMARY KEY(branchId,ingredientId));
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, phone TEXT DEFAULT '', branchId INTEGER REFERENCES branches(id));
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, userId INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL, phone TEXT NOT NULL, tax REAL NOT NULL, receiptNote TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, email TEXT DEFAULT '', points INTEGER NOT NULL DEFAULT 0, spent INTEGER NOT NULL DEFAULT 0, visits INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS ingredients (id INTEGER PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL, stock REAL NOT NULL, threshold REAL NOT NULL, cost INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL, cost INTEGER NOT NULL, image TEXT DEFAULT '', description TEXT DEFAULT '', available INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS recipes (productId INTEGER NOT NULL REFERENCES products(id), ingredientId INTEGER NOT NULL REFERENCES ingredients(id), quantity REAL NOT NULL, PRIMARY KEY(productId,ingredientId));
CREATE TABLE IF NOT EXISTS dining_tables (id INTEGER PRIMARY KEY, name TEXT NOT NULL, zone TEXT NOT NULL, seats INTEGER NOT NULL, reserved TEXT DEFAULT '', branchId INTEGER NOT NULL DEFAULT 1 REFERENCES branches(id), UNIQUE(branchId,name));
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, type TEXT NOT NULL, tableId INTEGER REFERENCES dining_tables(id), customerId INTEGER REFERENCES customers(id), status TEXT NOT NULL, subtotal INTEGER NOT NULL, discount INTEGER NOT NULL, tax INTEGER NOT NULL, total INTEGER NOT NULL, payment TEXT, received INTEGER, note TEXT DEFAULT '', createdAt TEXT NOT NULL, paidAt TEXT, staffId INTEGER NOT NULL REFERENCES users(id), branchId INTEGER NOT NULL DEFAULT 1 REFERENCES branches(id));
CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY, orderId INTEGER NOT NULL REFERENCES orders(id), productId INTEGER NOT NULL REFERENCES products(id), name TEXT NOT NULL, price INTEGER NOT NULL, cost INTEGER NOT NULL, quantity INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS stock_movements (id INTEGER PRIMARY KEY, ingredientId INTEGER NOT NULL REFERENCES ingredients(id), quantity REAL NOT NULL, reason TEXT NOT NULL, createdAt TEXT NOT NULL, staffId INTEGER NOT NULL REFERENCES users(id), branchId INTEGER NOT NULL DEFAULT 1 REFERENCES branches(id));
CREATE TABLE IF NOT EXISTS order_requests (requestKey TEXT PRIMARY KEY, orderId INTEGER NOT NULL REFERENCES orders(id), branchId INTEGER NOT NULL, staffId INTEGER NOT NULL, fingerprint TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS orders_branch_status ON orders(branchId,status);
CREATE INDEX IF NOT EXISTS items_order ON order_items(orderId);
CREATE INDEX IF NOT EXISTS movements_branch ON stock_movements(branchId,id);
CREATE TABLE IF NOT EXISTS order_stock (orderId INTEGER NOT NULL REFERENCES orders(id), ingredientId INTEGER NOT NULL REFERENCES ingredients(id), quantity REAL NOT NULL, PRIMARY KEY(orderId,ingredientId));
`);
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const one = (sql, ...params) => db.prepare(sql).get(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);
export function transaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function dayKey(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

if (!one("SELECT id FROM users LIMIT 1"))
  transaction(() => {
    for (const b of [
      [
        "Lá · Nguyễn Thị Minh Khai",
        "24 Nguyễn Thị Minh Khai, Quận 1, TP. Hồ Chí Minh",
        "028 3822 2468",
      ],
      [
        "Lá · Thảo Điền",
        "18 Xuân Thủy, Thảo Điền, TP. Thủ Đức",
        "028 3822 2469",
      ],
      [
        "Lá · Phú Mỹ Hưng",
        "86 Nguyễn Đức Cảnh, Quận 7, TP. Hồ Chí Minh",
        "028 3822 2470",
      ],
    ])
      run("INSERT INTO branches (name,address,phone) VALUES (?,?,?)", ...b);
    const password = bcrypt.hashSync(
      process.env.ADMIN_PASSWORD || "LaFnb@2026",
      10,
    );
    run(
      "INSERT INTO users (name,email,password,role,phone) VALUES (?,?,?,?,?)",
      "Minh Anh",
      "admin@lafnb.vn",
      password,
      "admin",
      "0901234567",
    );
    run(
      "INSERT INTO users (name,email,password,role,phone) VALUES (?,?,?,?,?)",
      "Hoàng Nam",
      "cashier@lafnb.vn",
      password,
      "cashier",
      "0902345678",
    );
    run(
      "INSERT INTO users (name,email,password,role,phone) VALUES (?,?,?,?,?)",
      "Thảo Nguyên",
      "kitchen@lafnb.vn",
      password,
      "kitchen",
      "0903456789",
    );
    run("UPDATE users SET branchId=1 WHERE role<>?", "admin");
    run(
      "INSERT INTO settings VALUES (1,?,?,?,?,?)",
      "Lá Coffee & Kitchen",
      "24 Nguyễn Thị Minh Khai, Quận 1, TP. Hồ Chí Minh",
      "028 3822 2468",
      8,
      "Cảm ơn bạn đã ghé Lá. Hẹn gặp lại bạn!",
    );
    for (const b of all("SELECT * FROM branches WHERE id>1"))
      run(
        "INSERT INTO settings VALUES (?,?,?,?,?,?)",
        b.id,
        "Lá Coffee & Kitchen",
        b.address,
        b.phone,
        8,
        "Cảm ơn bạn đã ghé Lá. Hẹn gặp lại bạn!",
      );
    for (const c of [
      ["Nguyễn Hà Linh", "0901112233", "linh@example.com", 120, 1200000, 8],
      ["Trần Quốc Bảo", "0902223344", "bao@example.com", 85, 850000, 5],
      ["Lê Thùy Dương", "0903334455", "duong@example.com", 210, 2100000, 12],
      ["Phạm Minh Tú", "0904445566", "tu@example.com", 45, 450000, 3],
      ["Võ Ngọc Anh", "0905556677", "anh@example.com", 60, 600000, 4],
    ])
      run(
        "INSERT INTO customers (name,phone,email,points,spent,visits) VALUES (?,?,?,?,?,?)",
        ...c,
      );
    for (const i of [
      ["Hạt cà phê Arabica", "kg", 4.8, 2, 280000],
      ["Sữa tươi", "lít", 3.5, 5, 32000],
      ["Trà ô long", "kg", 1.8, 0.5, 220000],
      ["Đường mía", "kg", 8, 3, 25000],
      ["Siro đào", "lít", 0.8, 1, 95000],
      ["Thịt bò", "kg", 6.2, 2, 210000],
      ["Bánh mì burger", "cái", 35, 15, 8000],
      ["Mì pasta", "kg", 4.2, 2, 65000],
      ["Rau xanh", "kg", 2.4, 3, 35000],
      ["Bánh croissant", "cái", 18, 8, 18000],
      ["Trứng gà", "quả", 45, 20, 3500],
      ["Bơ lạt", "kg", 1.6, 0.5, 180000],
    ])
      run(
        "INSERT INTO ingredients (name,unit,stock,threshold,cost) VALUES (?,?,?,?,?)",
        ...i,
      );
    const products = [
      [
        "Cà phê sữa đá",
        "Cà phê",
        39000,
        12000,
        "coffee",
        "Đậm vị cà phê Việt, ngọt ngào sữa đặc.",
      ],
      [
        "Latte",
        "Cà phê",
        55000,
        18000,
        "latte",
        "Espresso hòa cùng sữa tươi đánh mịn.",
      ],
      [
        "Americano",
        "Cà phê",
        45000,
        10000,
        "americano",
        "Espresso nguyên bản, thanh và đậm hương.",
      ],
      [
        "Cappuccino",
        "Cà phê",
        55000,
        18000,
        "cappuccino",
        "Lớp bọt sữa bồng bềnh trên nền espresso.",
      ],
      [
        "Trà đào cam sả",
        "Trà & trái cây",
        49000,
        15000,
        "tea",
        "Trà ô long, đào thơm và cam sả tươi mát.",
      ],
      [
        "Trà sữa ô long",
        "Trà & trái cây",
        49000,
        16000,
        "milktea",
        "Hương trà rang thơm hòa quyện cùng sữa.",
      ],
      [
        "Matcha latte",
        "Trà & trái cây",
        59000,
        21000,
        "matcha",
        "Matcha Nhật Bản và sữa tươi dịu béo.",
      ],
      [
        "Nước cam tươi",
        "Trà & trái cây",
        45000,
        18000,
        "orange",
        "Cam tươi ép nguyên chất mỗi ngày.",
      ],
      [
        "Burger bò phô mai",
        "Món chính",
        89000,
        38000,
        "burger",
        "Bò nướng mọng nước, cheddar và rau tươi.",
      ],
      [
        "Pasta bò bằm",
        "Món chính",
        99000,
        42000,
        "pasta",
        "Mì Ý cùng sốt cà chua và bò bằm nấu chậm.",
      ],
      [
        "Salad vườn Lá",
        "Món chính",
        69000,
        22000,
        "salad",
        "Rau theo mùa, trứng và sốt mè rang.",
      ],
      [
        "Bánh mì trứng",
        "Món chính",
        45000,
        15000,
        "sandwich",
        "Bánh mì giòn, trứng và rau xanh.",
      ],
      [
        "Croissant bơ",
        "Bánh ngọt",
        39000,
        21000,
        "croissant",
        "Bánh sừng bò nướng thơm bơ mỗi sáng.",
      ],
      [
        "Tiramisu",
        "Bánh ngọt",
        59000,
        25000,
        "cake",
        "Mascarpone mềm mịn, cacao và cà phê.",
      ],
      [
        "Cheesecake dâu",
        "Bánh ngọt",
        59000,
        23000,
        "cheesecake",
        "Phô mai béo nhẹ và mứt dâu chua ngọt.",
      ],
    ];
    for (const [name, category, price, cost, image, description] of products)
      run(
        "INSERT INTO products (name,category,price,cost,image,description) VALUES (?,?,?,?,?,?)",
        name,
        category,
        price,
        cost,
        `/images/${image}.jpg`,
        description,
      );
    for (const recipe of [
      [1, 1, 0.02],
      [1, 2, 0.06],
      [2, 1, 0.018],
      [2, 2, 0.18],
      [3, 1, 0.018],
      [4, 1, 0.018],
      [4, 2, 0.15],
      [5, 3, 0.012],
      [5, 5, 0.04],
      [6, 3, 0.012],
      [6, 2, 0.15],
      [7, 2, 0.2],
      [9, 6, 0.15],
      [9, 7, 1],
      [9, 9, 0.04],
      [10, 6, 0.12],
      [10, 8, 0.12],
      [11, 9, 0.15],
      [11, 11, 1],
      [12, 11, 2],
      [12, 9, 0.03],
      [13, 10, 1],
      [14, 1, 0.01],
    ])
      run("INSERT INTO recipes VALUES (?,?,?)", ...recipe);
    for (let n = 1; n <= 12; n++)
      run(
        "INSERT INTO dining_tables (name,zone,seats) VALUES (?,?,?)",
        `Bàn ${String(n).padStart(2, "0")}`,
        n <= 6 ? "Tầng 1" : n <= 10 ? "Tầng 2" : "Sân vườn",
        n % 3 === 0 ? 6 : n % 2 === 0 ? 4 : 2,
      );
    // Sample receipts are explicit historical transactions; initial stock is the current opening balance.
    for (let d = 13; d >= 0; d--) {
      const count = d === 0 ? 8 : 7 + ((d * 7) % 10);
      for (let j = 0; j < count; j++) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        if (d > 0) date.setHours(8 + (j % 12), (j * 7) % 60, 0, 0);
        else date.setMinutes(date.getMinutes() - (count - j) * 15);
        const p1 = one("SELECT * FROM products WHERE id=?", 1 + ((j + d) % 15));
        const p2 = one(
          "SELECT * FROM products WHERE id=?",
          1 + ((j * 3 + d + 2) % 15),
        );
        const qty = (j % 3) + 1;
        const subtotal = p1.price * qty + p2.price;
        const tax = Math.round(subtotal * 0.08);
        const id = Number(
          run(
            "INSERT INTO orders (type,status,subtotal,discount,tax,total,payment,received,createdAt,paidAt,staffId) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            j % 4 === 0 ? "takeaway" : "dinein",
            "completed",
            subtotal,
            0,
            tax,
            subtotal + tax,
            j % 3 === 0 ? "cash" : j % 3 === 1 ? "transfer" : "card",
            subtotal + tax,
            date.toISOString(),
            date.toISOString(),
            (j % 2) + 1,
          ).lastInsertRowid,
        );
        for (const [p, q] of [
          [p1, qty],
          [p2, 1],
        ])
          run(
            "INSERT INTO order_items (orderId,productId,name,price,cost,quantity) VALUES (?,?,?,?,?,?)",
            id,
            p.id,
            p.name,
            p.price,
            p.cost,
            q,
          );
      }
    }
    for (const [tableId, status, productId, quantity] of [
      [2, "cooking", 1, 2],
      [5, "ready", 9, 2],
      [8, "pending", 5, 3],
    ]) {
      const p = one("SELECT * FROM products WHERE id=?", productId);
      const subtotal = p.price * quantity;
      const tax = Math.round(subtotal * 0.08);
      const id = Number(
        run(
          "INSERT INTO orders (type,tableId,status,subtotal,discount,tax,total,note,createdAt,staffId) VALUES (?,?,?,?,?,?,?,?,?,?)",
          "dinein",
          tableId,
          status,
          subtotal,
          0,
          tax,
          subtotal + tax,
          tableId === 8 ? "Ít đá, ít đường" : "",
          new Date(
            Date.now() - (tableId === 2 ? 8 : tableId === 5 ? 12 : 3) * 60000,
          ).toISOString(),
          2,
        ).lastInsertRowid,
      );
      run(
        "INSERT INTO order_items (orderId,productId,name,price,cost,quantity) VALUES (?,?,?,?,?,?)",
        id,
        p.id,
        p.name,
        p.price,
        p.cost,
        quantity,
      );
      for (const r of all(
        "SELECT * FROM recipes WHERE productId=?",
        productId,
      )) {
        run(
          "UPDATE ingredients SET stock=stock-? WHERE id=?",
          r.quantity * quantity,
          r.ingredientId,
        );
        run(
          "INSERT INTO order_stock VALUES (?,?,?)",
          id,
          r.ingredientId,
          r.quantity * quantity,
        );
      }
    }
    for (const b of all("SELECT * FROM branches"))
      for (const i of all("SELECT * FROM ingredients"))
        run(
          "INSERT INTO branch_stock VALUES (?,?,?,?)",
          b.id,
          i.id,
          b.id === 1
            ? i.stock
            : Number((i.stock * (b.id === 2 ? 1.3 : 0.8)).toFixed(3)),
          i.threshold,
        );
    for (const b of all("SELECT * FROM branches WHERE id>1")) {
      for (let n = 1; n <= 8; n++)
        run(
          "INSERT INTO dining_tables (name,zone,seats,branchId) VALUES (?,?,?,?)",
          `Bàn ${String(n).padStart(2, "0")}`,
          n <= 4 ? "Tầng 1" : "Sân vườn",
          n % 2 ? 2 : 4,
          b.id,
        );
      for (let d = 13; d >= 0; d--)
        for (let j = 0; j < (d === 0 ? 5 : 5 + ((d + b.id) % 7)); j++) {
          const date = new Date();
          date.setDate(date.getDate() - d);
          if (d > 0) date.setHours(8 + (j % 10), (j * 7) % 60, 0, 0);
          else date.setMinutes(date.getMinutes() - (5 - j) * 20);
          const p = one(
            "SELECT * FROM products WHERE id=?",
            1 + ((j * 2 + d + b.id) % 15),
          );
          const quantity = 2 + (j % 3);
          const subtotal = p.price * quantity;
          const tax = Math.round(subtotal * 0.08);
          const id = Number(
            run(
              "INSERT INTO orders (type,status,subtotal,discount,tax,total,payment,received,createdAt,paidAt,staffId,branchId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
              "dinein",
              "completed",
              subtotal,
              0,
              tax,
              subtotal + tax,
              j % 2 ? "cash" : "transfer",
              subtotal + tax,
              date.toISOString(),
              date.toISOString(),
              1,
              b.id,
            ).lastInsertRowid,
          );
          run(
            "INSERT INTO order_items (orderId,productId,name,price,cost,quantity) VALUES (?,?,?,?,?,?)",
            id,
            p.id,
            p.name,
            p.price,
            p.cost,
            quantity,
          );
        }
    }
  });

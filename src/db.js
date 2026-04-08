import initSqlJs from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'baqala.db');

let db;

export async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (existsSync(DB_PATH)) {
    db = new SQL.Database(readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY, name_ar TEXT NOT NULL, phone TEXT UNIQUE NOT NULL,
      city TEXT DEFAULT 'بغداد', neighborhood TEXT, address TEXT,
      driver_phone TEXT, delivery_provider TEXT DEFAULT 'merchant_driver',
      commission_pct REAL DEFAULT 5.0, active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, merchant_id TEXT, name_ar TEXT NOT NULL,
      price_iqd INTEGER NOT NULL, unit TEXT DEFAULT 'كيلو',
      category TEXT DEFAULT 'أخرى', image_url TEXT, in_stock INTEGER DEFAULT 1,
      weight_kg REAL, updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(merchant_id, name_ar)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, merchant_id TEXT, customer_phone TEXT NOT NULL,
      customer_name TEXT, address TEXT, items TEXT NOT NULL DEFAULT '[]',
      total_iqd INTEGER DEFAULT 0, status TEXT DEFAULT 'pending',
      updated_at TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, merchant_id TEXT, phone TEXT NOT NULL,
      direction TEXT NOT NULL, content TEXT, message_type TEXT DEFAULT 'text',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  save();
  return db;
}

function save() { if (db) writeFileSync(DB_PATH, Buffer.from(db.export())); }

function qOne(sql, params = []) {
  const d = db; const stmt = d.prepare(sql);
  stmt.bind(params);
  if (!stmt.step()) { stmt.free(); return null; }
  const cols = stmt.getColumnNames(); const vals = stmt.get(); stmt.free();
  const obj = {}; cols.forEach((c, i) => obj[c] = vals[i]); return obj;
}

function qAll(sql, params = []) {
  const d = db; const stmt = d.prepare(sql);
  stmt.bind(params);
  const result = []; const cols = stmt.getColumnNames();
  while (stmt.step()) {
    const vals = stmt.get(); const obj = {};
    cols.forEach((c, i) => obj[c] = vals[i]); result.push(obj);
  }
  stmt.free(); return result;
}

const parseItems = (r) => r ? { ...r, items: JSON.parse(r.items || '[]') } : null;


// ── Merchants ──
export async function getMerchant(merchantId) {
  await getDb();
  return qOne('SELECT * FROM merchants WHERE id = ?', [merchantId]);
}

export async function getMerchantByPhone(phone) {
  await getDb();
  return qOne('SELECT * FROM merchants WHERE phone = ? AND active = 1', [phone]);
}

export async function getAllActiveMerchantPhones() {
  await getDb();
  return qAll('SELECT phone FROM merchants WHERE active = 1').map(m => m.phone);
}

export async function createMerchant(merchant) {
  await getDb();
  const id = merchant.id || uuidv4().slice(0, 8);
  db.run('INSERT OR IGNORE INTO merchants (id, name_ar, phone, neighborhood, address, driver_phone, delivery_provider) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, merchant.name_ar, merchant.phone, merchant.neighborhood || null, merchant.address || null, merchant.driver_phone || null, merchant.delivery_provider || 'merchant_driver']);
  save();
  return qOne('SELECT * FROM merchants WHERE id = ?', [id]);
}

// ── Catalog ──
export async function getCatalog(merchantId) {
  await getDb();
  return qAll('SELECT * FROM products WHERE merchant_id = ? ORDER BY category', [merchantId]);
}

export async function upsertProduct(merchantId, product) {
  await getDb();
  const id = uuidv4(); const now = new Date().toISOString();
  db.run(`INSERT INTO products (id, merchant_id, name_ar, price_iqd, unit, category, in_stock, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(merchant_id, name_ar) DO UPDATE SET
      price_iqd = excluded.price_iqd, unit = excluded.unit,
      category = excluded.category, in_stock = 1, updated_at = excluded.updated_at`,
    [id, merchantId, product.name_ar, product.price_iqd, product.unit || 'كيلو', product.category || 'أخرى', now]);
  save();
  return qOne('SELECT * FROM products WHERE merchant_id = ? AND name_ar = ?', [merchantId, product.name_ar]);
}

export async function markOutOfStock(productId, out) {
  await getDb();
  db.run('UPDATE products SET in_stock = ?, updated_at = ? WHERE id = ?', [out ? 0 : 1, new Date().toISOString(), productId]);
  save();
}

// ── Orders ──
export async function createOrder(order) {
  await getDb();
  const id = uuidv4().slice(0, 8);
  db.run('INSERT INTO orders (id, merchant_id, customer_phone, customer_name, address, items, total_iqd, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, order.merchant_id, order.customer_phone, order.customer_name || null, order.address || null, JSON.stringify(order.items || []), order.total_iqd || 0, 'pending']);
  save();
  return parseItems(qOne('SELECT * FROM orders WHERE id = ?', [id]));
}

export async function getOrderByPhone(phone) {
  await getDb();
  return parseItems(qOne('SELECT * FROM orders WHERE customer_phone = ? ORDER BY created_at DESC LIMIT 1', [phone]));
}

export async function getOrderById(orderId) {
  await getDb();
  return parseItems(qOne('SELECT * FROM orders WHERE id LIKE ?', [orderId + '%']));
}

export async function getTodayOrders(merchantId) {
  await getDb();
  const today = new Date().toISOString().split('T')[0];
  return qAll('SELECT * FROM orders WHERE merchant_id = ? AND created_at >= ? ORDER BY created_at DESC', [merchantId, today])
    .map(o => ({ ...o, items: JSON.parse(o.items || '[]'), items_summary: JSON.parse(o.items || '[]').map(i => `${i.name} x${i.qty}`).join(', ') }));
}

export async function getDailySummary(merchantId) {
  await getDb();
  const today = new Date().toISOString().split('T')[0];
  const orders = qAll('SELECT * FROM orders WHERE merchant_id = ? AND created_at >= ?', [merchantId, today])
    .map(o => ({ ...o, items: JSON.parse(o.items || '[]') }));
  const completed = orders.filter(o => o.status === 'delivered');
  const refused = orders.filter(o => o.status === 'refused');
  const partial = orders.filter(o => o.status === 'partial');
  return {
    totalOrders: orders.length, completedOrders: completed.length,
    refusedOrders: refused.length, partialOrders: partial.length,
    totalRevenue: completed.reduce((s, o) => s + (o.total_iqd || 0), 0),
    refusalRate: orders.length ? Math.round(refused.length / orders.length * 100) : 0,
    orders,
  };
}

// ── Order Status ──
export async function updateOrderStatus(orderId, status) {
  await getDb();
  db.run('UPDATE orders SET status = ?, updated_at = ? WHERE id LIKE ?', [status, new Date().toISOString(), orderId + '%']);
  save();
  return getOrderById(orderId);
}

export async function getCustomerRefusalCount(customerPhone) {
  await getDb();
  const r = qOne('SELECT COUNT(*) as cnt FROM orders WHERE customer_phone = ? AND status = ?', [customerPhone, 'refused']);
  return r?.cnt || 0;
}

// ── Messages ──
export async function logMessage(merchantId, phone, direction, content, messageType = 'text') {
  await getDb();
  db.run('INSERT INTO messages (id, merchant_id, phone, direction, content, message_type) VALUES (?, ?, ?, ?, ?, ?)',
    [uuidv4(), merchantId, phone, direction, content, messageType]);
  save();
}

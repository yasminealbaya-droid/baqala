/**
 * Supabase backend — drop-in replacement for db.js (sql.js).
 * Set SUPABASE_URL + SUPABASE_SERVICE_KEY in .env to activate.
 * Uses service_role key for full RLS bypass from backend.
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── Merchants ──
export async function getMerchant(merchantId) {
  const { data } = await supabase.from('merchants').select('*').eq('id', merchantId).single();
  return data;
}

export async function getMerchantByPhone(phone) {
  const { data } = await supabase.from('merchants').select('*').eq('phone', phone).eq('active', true).single();
  return data;
}

export async function getAllActiveMerchantPhones() {
  const { data } = await supabase.from('merchants').select('phone').eq('active', true);
  return (data || []).map(m => m.phone);
}

export async function createMerchant(merchant) {
  const id = merchant.id || crypto.randomUUID().slice(0, 8);
  const { data } = await supabase.from('merchants').upsert({
    id, name_ar: merchant.name_ar, phone: merchant.phone,
    neighborhood: merchant.neighborhood || null,
    address: merchant.address || null,
    driver_phone: merchant.driver_phone || null,
    delivery_provider: merchant.delivery_provider || 'merchant_driver',
  }, { onConflict: 'phone' }).select().single();
  return data;
}

// ── Catalog ──
export async function getCatalog(merchantId) {
  const { data } = await supabase.from('products').select('*').eq('merchant_id', merchantId).order('category');
  return data || [];
}

export async function upsertProduct(merchantId, product) {
  const { data } = await supabase.from('products').upsert({
    id: crypto.randomUUID().slice(0, 8),
    merchant_id: merchantId, name_ar: product.name_ar,
    price_iqd: product.price_iqd, unit: product.unit || 'كيلو',
    category: product.category || 'أخرى', in_stock: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'merchant_id,name_ar' }).select().single();
  return data;
}


export async function markOutOfStock(productId, out) {
  await supabase.from('products').update({
    in_stock: !out, updated_at: new Date().toISOString()
  }).eq('id', productId);
}

// ── Orders ──
export async function createOrder(order) {
  const id = crypto.randomUUID().slice(0, 8);
  const { data } = await supabase.from('orders').insert({
    id, merchant_id: order.merchant_id,
    customer_phone: order.customer_phone,
    customer_name: order.customer_name || null,
    address: order.address || null,
    items: order.items || [],
    total_iqd: order.total_iqd || 0,
    status: 'pending',
  }).select().single();
  return data;
}

export async function getOrderByPhone(phone) {
  const { data } = await supabase.from('orders').select('*')
    .eq('customer_phone', phone).order('created_at', { ascending: false }).limit(1).single();
  return data;
}

export async function getOrderById(orderId) {
  const { data } = await supabase.from('orders').select('*').ilike('id', orderId + '%').single();
  return data;
}

export async function getTodayOrders(merchantId) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase.from('orders').select('*')
    .eq('merchant_id', merchantId).gte('created_at', today)
    .order('created_at', { ascending: false });
  return (data || []).map(o => ({
    ...o, items_summary: (o.items || []).map(i => `${i.name} x${i.qty}`).join(', ')
  }));
}

export async function getDailySummary(merchantId) {
  const today = new Date().toISOString().split('T')[0];
  const { data: orders } = await supabase.from('orders').select('*')
    .eq('merchant_id', merchantId).gte('created_at', today);
  const all = orders || [];
  const completed = all.filter(o => o.status === 'delivered');
  const refused = all.filter(o => o.status === 'refused');
  const partial = all.filter(o => o.status === 'partial');
  return {
    totalOrders: all.length, completedOrders: completed.length,
    refusedOrders: refused.length, partialOrders: partial.length,
    totalRevenue: completed.reduce((s, o) => s + (o.total_iqd || 0), 0),
    refusalRate: all.length ? Math.round(refused.length / all.length * 100) : 0,
    orders: all,
  };
}

// ── Order Status ──
export async function updateOrderStatus(orderId, status) {
  await supabase.from('orders').update({
    status, updated_at: new Date().toISOString()
  }).ilike('id', orderId + '%');
  return getOrderById(orderId);
}

export async function getCustomerRefusalCount(customerPhone) {
  const { count } = await supabase.from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('customer_phone', customerPhone).eq('status', 'refused');
  return count || 0;
}

// ── Messages ──
export async function logMessage(merchantId, phone, direction, content, messageType = 'text') {
  await supabase.from('messages').insert({
    merchant_id: merchantId, phone, direction, content, message_type: messageType,
  });
}
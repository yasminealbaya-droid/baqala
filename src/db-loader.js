/**
 * DB backend auto-selector.
 * - SUPABASE_URL set → uses Supabase (production)
 * - Otherwise → uses sql.js (local dev)
 *
 * All other modules import from db.js which stays unchanged.
 * To switch: replace db.js import in index.js/ai.js with this loader,
 * or rename this to db.js when ready to go live.
 */
const USE_SUPABASE = !!process.env.SUPABASE_URL;

const backend = USE_SUPABASE
  ? await import('./db-supabase.js')
  : await import('./db.js');

console.log(`💾 DB: ${USE_SUPABASE ? 'Supabase (remote)' : 'sql.js (local)'}`);

export const {
  getMerchant, getMerchantByPhone, getAllActiveMerchantPhones, createMerchant,
  getCatalog, upsertProduct, markOutOfStock,
  createOrder, getOrderByPhone, getOrderById, getTodayOrders, getDailySummary,
  updateOrderStatus, getCustomerRefusalCount,
  logMessage,
} = backend;

// Re-export getDb only for sql.js (Supabase doesn't need it)
export const getDb = backend.getDb || (() => {});

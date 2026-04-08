import { getDailySummary } from './db-loader.js';
import { sendWhatsAppMessage } from './whatsapp.js';

/**
 * Daily 9 PM Baghdad summary to merchant.
 * Trigger via cron (Railway cron / cron-job.org). TZ=Asia/Baghdad
 */
export async function sendDailySummary(merchantId, merchantPhone, phoneNumberId) {
  const { totalOrders, totalRevenue, orders } = await getDailySummary(merchantId);

  if (totalOrders === 0) {
    return sendWhatsAppMessage(phoneNumberId, merchantPhone,
      'مساء الخير 🌙\nما اكو طلبات اليوم. إن شاء الله بكرة أحسن!');
  }

  const lines = orders.slice(0, 20).map((o, i) =>
    `${i+1}. ${o.customer_name||'زبون'} - ${o.items?.map(it=>`${it.name} x${it.qty}`).join(', ')}\n   📍 ${o.address||'-'}\n   💰 ${(o.total_iqd||0).toLocaleString()} د`
  ).join('\n\n');

  await sendWhatsAppMessage(phoneNumberId, merchantPhone,
    `مساء الخير 🌙\n\n📊 ملخص اليوم:\n🛒 ${totalOrders} طلب\n💰 ${totalRevenue.toLocaleString()} دينار\n\n${lines}${totalOrders>20?`\n\n... و ${totalOrders-20} طلب آخر`:''}\n\nيلا نكمل بكرة إن شاء الله 💪`);
}

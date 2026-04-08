import { chat, vision, extractJSON } from './gemini.js';
import { sendWhatsAppMessage } from './whatsapp.js';
import { upsertProduct, markOutOfStock, getCatalog, getTodayOrders, updateOrderStatus, getCustomerRefusalCount } from './db-loader.js';

export async function handleMerchantMessage({ from, content, messageType, phoneNumberId, merchant }) {
  const mid = merchant?.id;
  if (!mid) return sendWhatsAppMessage(phoneNumberId, from, '⚠️ ما لكيت حسابك. تواصل مع الدعم.');
  const text = content.trim();

  // Order status: "رفض XXXX" / "جزئي XXXX" / "وصل XXXX"
  const statusMatch = text.match(/^(رفض|جزئي|وصل)\s+([a-f0-9]{4,8})/i);
  if (statusMatch) {
    const [, cmd, orderId] = statusMatch;
    const statusMap = { 'رفض': 'refused', 'جزئي': 'partial', 'وصل': 'delivered' };
    const order = await updateOrderStatus(orderId, statusMap[cmd]);
    if (!order) return sendWhatsAppMessage(phoneNumberId, from, `ما لكيت طلب #${orderId}`);
    const labels = { refused: '❌ رفض كامل', partial: '📝 استلام جزئي', delivered: '✅ تم التسليم' };
    let msg = `${labels[statusMap[cmd]]}\nطلب #${orderId}`;
    if (statusMap[cmd] === 'refused') {
      const cnt = await getCustomerRefusalCount(order.customer_phone);
      msg += `\n📦 المنتجات رجعت للمخزون\n👤 رفض #${cnt}`;
    }
    if (statusMap[cmd] === 'delivered') msg += `\n💰 ${(order.total_iqd||0).toLocaleString()} د`;
    return sendWhatsAppMessage(phoneNumberId, from, msg);
  }

  if (/طلبات|اوامر|orders/.test(text)) {
    const orders = await getTodayOrders(mid);
    if (!orders.length) return sendWhatsAppMessage(phoneNumberId, from, 'ما اكو طلبات اليوم بعد');
    const s = orders.map(o => `#${o.id} ${o.customer_name||'—'} — ${o.status} — ${(o.total_iqd||0).toLocaleString()} د`).join('\n');
    return sendWhatsAppMessage(phoneNumberId, from, `📋 طلبات اليوم (${orders.length}):\n${s}`);
  }

  if (/كتالوج|قائمة|catalog/.test(text)) {
    const cat = await getCatalog(mid);
    const list = cat.map(p => `${p.in_stock?'✅':'❌'} ${p.name_ar} - ${p.price_iqd?.toLocaleString()} د/${p.unit}`).join('\n');
    return sendWhatsAppMessage(phoneNumberId, from, `📦 الكتالوج (${cat.length}):\n${list}`);
  }

  if (/خلص|نفذ/.test(text)) {
    const p = await matchProduct(mid, text);
    if (p) { await markOutOfStock(p.id, true); return sendWhatsAppMessage(phoneNumberId, from, `✅ شلت "${p.name_ar}" من المتوفر`); }
    return sendWhatsAppMessage(phoneNumberId, from, 'شنو المنتج اللي خلص؟');
  }

  if (/رجع|توفر/.test(text)) {
    const p = await matchProduct(mid, text);
    const priceMatch = text.match(/(\d[\d,]*)/);
    if (p) {
      const updates = {};
      if (priceMatch) updates.price_iqd = parseInt(priceMatch[1].replace(/,/g, ''));
      await upsertProduct(mid, { ...p, ...updates, in_stock: true });
      const note = updates.price_iqd ? ` بسعر ${updates.price_iqd.toLocaleString()} د` : '';
      return sendWhatsAppMessage(phoneNumberId, from, `✅ رجعت "${p.name_ar}"${note}`);
    }
    return sendWhatsAppMessage(phoneNumberId, from, 'شنو المنتج اللي رجع؟');
  }

  if (looksLikeCatalog(text)) return handleBulkCatalog(phoneNumberId, from, mid, text);

  await sendWhatsAppMessage(phoneNumberId, from,
    'هلا! اكدر اساعدك بـ:\n📸 صورة = إضافة منتج\n🎤 صوتية = إضافة جملة\n📋 "طلبات" = طلبات اليوم\n📦 "كتالوج" = المنتجات\n❌ "رفض XXXX" = رفض طلب\n✅ "وصل XXXX" = تسليم');
}

async function handleBulkCatalog(phoneNumberId, from, mid, transcription) {
  try {
    const raw = await extractJSON(
      'Extract grocery products from Iraqi Arabic. Return JSON: {"products":[{"name_ar":"...","price_iqd":number,"unit":"كيلو|حبة|باكيت|علبة|كارتون"}]}',
      transcription
    );
    const { products } = JSON.parse(raw);
    if (!products?.length) return sendWhatsAppMessage(phoneNumberId, from, 'ما كدرت استخرج منتجات، ممكن تعيد؟');
    for (const p of products) await upsertProduct(mid, { ...p, in_stock: true });
    const list = products.map(p => `✅ ${p.name_ar} - ${p.price_iqd?.toLocaleString()} د/${p.unit}`).join('\n');
    await sendWhatsAppMessage(phoneNumberId, from, `تمام! ضفت ${products.length} منتج:\n${list}\nزين هيچي؟`);
  } catch { await sendWhatsAppMessage(phoneNumberId, from, 'صار خطأ، ممكن تعيد؟'); }
}

function looksLikeCatalog(text) { return /\d{3,}/.test(text) && /كيلو|حبة|دينار|الف|باكيت/.test(text); }

async function matchProduct(mid, text) {
  const cat = await getCatalog(mid);
  return cat.find(p => text.includes(p.name_ar) || text.includes(p.name_ar.replace(/ة$/, ''))) || null;
}

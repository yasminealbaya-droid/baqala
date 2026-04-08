import { chat } from './gemini.js';
import { sendWhatsAppMessage } from './whatsapp.js';
import { getCatalog, getOrderByPhone, getCustomerRefusalCount, getAllActiveMerchantPhones, getMerchantByPhone } from './db-loader.js';

function buildSystemPrompt(catalog) {
  const items = catalog.map(p =>
    `- ${p.name_ar}: ${p.price_iqd?.toLocaleString()} دينار/${p.unit}${p.in_stock ? '' : ' (نفذ)'}`
  ).join('\n');
  return `أنت مساعد مبيعات ذكي لبقالة عراقية.
تحچي عراقي صرف: هلا، شلونك، شكد، شنو، اكو، ماكو، زين، خوش.
استخدم "حبيبي" و "عيوني" بشكل طبيعي. لا تستخدم الفصحى.
المنتجات:\n${items}\n
اجمع: الاسم، العنوان، المنتجات والكميات. أكد الطلب. الدفع كاش عند الاستلام.`;
}

const conversations = new Map();

export async function handleCustomerMessage({ from, content, messageType, phoneNumberId }) {
  const phones = await getAllActiveMerchantPhones();
  const merchant = phones.length ? await getMerchantByPhone(phones[0]) : null;
  const catalog = merchant ? await getCatalog(merchant.id) : [];
  const systemPrompt = buildSystemPrompt(catalog);

  if (!conversations.has(from)) conversations.set(from, []);
  const history = conversations.get(from);
  history.push({ role: 'user', content });

  let extra = '';
  const refusals = await getCustomerRefusalCount(from);
  if (refusals >= 3) extra = `\n⚠️ هذا الزبون عنده ${refusals} رفض. اطلب تأكيد إضافي.`;
  if (/طلب|وين|talabi|order/.test(content)) {
    const order = await getOrderByPhone(from);
    if (order) extra += `\n[آخر طلب: #${order.id}, حالة: ${order.status}]`;
  }

  const reply = await chat(systemPrompt + extra, history.slice(-20), { temperature: 0.7, maxTokens: 500 });
  history.push({ role: 'assistant', content: reply });
  await sendWhatsAppMessage(phoneNumberId, from, reply);
}

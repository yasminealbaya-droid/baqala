import { GoogleGenerativeAI } from '@google/generative-ai';
import { chat as groqChat, extractJSON as groqExtractJSON } from './groq.js';

const API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_DISABLED = !API_KEY || API_KEY === 'mock';
const GROQ_AVAILABLE = !!process.env.GROQ_API_KEY;
const MOCK_MODE = GEMINI_DISABLED && !GROQ_AVAILABLE;

let genAI;
if (!GEMINI_DISABLED) genAI = new GoogleGenerativeAI(API_KEY);

if (GEMINI_DISABLED && GROQ_AVAILABLE) console.log('🧠 AI: Groq LLaMA 3.3 70B (Gemini disabled)');
else if (MOCK_MODE) console.log('⚠️  AI: MOCK MODE — no API keys set.');

const MOCK = {
  greeting: 'هلا وغلا حبيبي! 👋\nأنا مساعد بقالة أبو حسن.\nشنو تحتاج اليوم؟',
  catalog: JSON.stringify([
    { name_ar: 'طماطة', price_iqd: 2500, unit: 'كيلو', category: 'خضار' },
    { name_ar: 'بطاطا', price_iqd: 1500, unit: 'كيلو', category: 'خضار' },
    { name_ar: 'دجاج', price_iqd: 12000, unit: 'حبة', category: 'لحوم' },
  ]),
  order: '🛒 طلبك حبيبي:\n\n🍅 طماطة x2 — 5,000 د\n🥔 بطاطا x1 — 1,500 د\n\n💰 المجموع: 6,500 د\n💵 كاش عند الاستلام\n\nشنو اسمك وعنوانك؟',
  confirm: 'تمام! ✅ أرسلت الطلب لأبو حسن.\nالتوصيل خلال ساعة إن شاء الله 🚗',
  fallback: 'هلا! شلون اكدر اساعدك؟ 🛒',
};

function mockChat(history) {
  const last = (history[history.length - 1]?.content || '').toLowerCase();
  if (/هلا|مرحبا|hala|hi|hello/.test(last)) return MOCK.greeting;
  if (/ابي|اريد|abiha|order|طماط|بطاط|دجاج/.test(last)) return MOCK.order;
  if (/اسم|عنوان|name|address|زيونة|منصور/.test(last)) return MOCK.confirm;
  return MOCK.fallback;
}

export async function chat(systemPrompt, history, opts = {}) {
  // Priority: Gemini → Groq → Mock
  if (!GEMINI_DISABLED) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: systemPrompt,
        generationConfig: {
          temperature: opts.temperature ?? 0.7,
          maxOutputTokens: opts.maxTokens ?? 500,
          ...(opts.json ? { responseMimeType: 'application/json' } : {}),
        },
      });
      const contents = history.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const result = await model.generateContent({ contents });
      return result.response.text();
    } catch (err) {
      console.error('Gemini error:', err.message);
      if (GROQ_AVAILABLE) return groqChat(systemPrompt, history, opts);
      return mockChat(history);
    }
  }
  if (GROQ_AVAILABLE) return groqChat(systemPrompt, history, opts);
  return mockChat(history);
}

export async function vision(prompt, imageBuffer, mimeType, opts = {}) {
  if (GEMINI_DISABLED) return MOCK.catalog; // Vision requires Gemini — no Groq equivalent
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.1, maxOutputTokens: 200,
      ...(opts.json ? { responseMimeType: 'application/json' } : {}),
    },
  });
  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { data: imageBuffer.toString('base64'), mimeType } },
  ]);
  return result.response.text();
}

export async function extractJSON(systemPrompt, userText) {
  if (!GEMINI_DISABLED) {
    return chat(systemPrompt, [{ role: 'user', content: userText }], {
      temperature: 0.1, maxTokens: 1000, json: true,
    });
  }
  if (GROQ_AVAILABLE) return groqExtractJSON(systemPrompt, userText);
  return MOCK.catalog;
}

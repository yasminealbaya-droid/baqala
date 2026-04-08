import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { handleWebhook, verifyWebhook } from './webhook.js';
import { handleBoxyWebhook } from './delivery.js';
import { updateOrderStatus } from './db-loader.js';
import { routeMessage } from './router.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// ── WhatsApp webhook ──
app.get('/webhook', verifyWebhook);
app.post('/webhook', handleWebhook);

// ── Boxy delivery webhook ──
app.post('/webhook/boxy', async (req, res) => {
  try {
    const result = await handleBoxyWebhook(req.body);
    if (result.handled && result.mapped_status) {
      await updateOrderStatus(result.baqala_order_id, result.mapped_status);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Boxy webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Local test harness (serves UI at /test) ──
app.use('/test', express.static(join(__dirname, '..', 'test')));

// Local test API: seed a test merchant
app.post('/test/seed', async (req, res) => {
  try {
    const { createMerchant } = await import('./db-loader.js');
    const phone = req.body.phone || '964770000001';
    const merchant = createMerchant({
      name_ar: 'بقالة أبو حسن (تجربة)',
      phone,
      neighborhood: 'زيونة',
      address: 'بغداد، زيونة، شارع الربيعي',
      delivery_provider: 'merchant_driver',
    });
    res.json({ ok: true, merchant });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Local test API: simulate a WhatsApp message
const testResponses = [];
globalThis.__baqalaTestMode = false;
globalThis.__baqalaCapture = (to, text) => { if (globalThis.__baqalaTestMode) testResponses.push({ to, text, time: new Date().toISOString() }); };

app.post('/test/send', async (req, res) => {
  const { from, content, messageType } = req.body;
  if (!from || !content) return res.status(400).json({ error: 'from and content required' });
  testResponses.length = 0;
  globalThis.__baqalaTestMode = true;
  try {
    await routeMessage({ from, content, messageType: messageType || 'text', phoneNumberId: 'test' });
    res.json({ ok: true, responses: [...testResponses] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    globalThis.__baqalaTestMode = false;
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'baqala', mode: 'local' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🛒 Baqala running on port ${PORT}`);
  console.log(`   Test harness: http://localhost:${PORT}/test`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});

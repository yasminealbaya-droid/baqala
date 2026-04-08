import { routeMessage } from './router.js';
import { sendWhatsAppMessage } from './whatsapp.js';

export function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
    console.log('Webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
}

export async function handleWebhook(req, res) {
  // Always respond 200 immediately (WhatsApp requires fast ACK)
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    if (!change?.messages?.[0]) return;

    const msg = change.messages[0];
    const from = msg.from; // customer phone number
    const phoneNumberId = change.metadata.phone_number_id;

    let content = '';
    let messageType = msg.type;

    if (msg.type === 'text') {
      content = msg.text.body;
    } else if (msg.type === 'audio') {
      content = msg.audio.id;
      messageType = 'audio';
    } else if (msg.type === 'image') {
      content = msg.image.id;
      messageType = 'image';
      if (msg.image.caption) content += `|${msg.image.caption}`;
    } else {
      await sendWhatsAppMessage(phoneNumberId, from,
        'هلا! حالياً اكدر اساعدك بالرسائل النصية والصوتية والصور فقط 👍');
      return;
    }

    await routeMessage({ from, content, messageType, phoneNumberId });
  } catch (err) {
    console.error('Webhook error:', err);
  }
}

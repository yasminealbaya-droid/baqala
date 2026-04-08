import axios from 'axios';

const WA_API = 'https://graph.facebook.com/v21.0';

export async function sendWhatsAppMessage(phoneNumberId, to, text) {
  // Test mode: capture instead of sending
  if (globalThis.__baqalaTestMode) {
    globalThis.__baqalaCapture?.(to, text);
    return;
  }
  await axios.post(
    `${WA_API}/${phoneNumberId}/messages`,
    { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } },
    { headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`, 'Content-Type': 'application/json' } }
  );
}

export async function sendWhatsAppImage(phoneNumberId, to, imageUrl, caption) {
  await axios.post(
    `${WA_API}/${phoneNumberId}/messages`,
    { messaging_product: 'whatsapp', to, type: 'image', image: { link: imageUrl, caption } },
    { headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`, 'Content-Type': 'application/json' } }
  );
}

/** Download media from WhatsApp (voice notes, images). Returns Buffer + mimeType. */
export async function downloadMedia(mediaId) {
  const { data: meta } = await axios.get(`${WA_API}/${mediaId}`, {
    headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}` },
  });
  const { data } = await axios.get(meta.url, {
    headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}` },
    responseType: 'arraybuffer',
  });
  return { buffer: Buffer.from(data), mimeType: meta.mime_type };
}

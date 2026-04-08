import { sendWhatsAppMessage } from './whatsapp.js';
import { handleCustomerMessage } from './ai.js';
import { handleMerchantMessage } from './merchant.js';
import { transcribeVoiceNote } from './voice.js';
import { normalizeArabizi } from './arabizi.js';

const MERCHANT_PHONES = new Set([process.env.MERCHANT_PHONE]);

export async function routeMessage({ from, content, messageType, phoneNumberId }) {
  const isMerchant = MERCHANT_PHONES.has(from);

  // Voice notes: transcribe first, then route as text
  if (messageType === 'audio') {
    const transcription = await transcribeVoiceNote(content);
    if (!transcription) {
      await sendWhatsAppMessage(phoneNumberId, from,
        isMerchant ? 'ما كدرت افهم الصوتية، ممكن تعيدها؟' : 'ما كدرت افهم الرسالة الصوتية، ممكن تعيدها؟');
      return;
    }
    content = transcription;
    messageType = 'text';
  }

  // Normalize Arabizi for text messages
  if (messageType === 'text') content = normalizeArabizi(content);

  if (isMerchant) {
    await handleMerchantMessage({ from, content, messageType, phoneNumberId });
  } else {
    await handleCustomerMessage({ from, content, messageType, phoneNumberId });
  }
}

import { transcribe } from './groq.js';
import { downloadMedia } from './whatsapp.js';

/**
 * Transcribe a WhatsApp voice note using Groq Whisper large-v3.
 * Free tier: 30 RPM, 14400 RPD. Iraqi Arabic with dialect hints.
 */
export async function transcribeVoiceNote(mediaId) {
  try {
    const { buffer, mimeType } = await downloadMedia(mediaId);
    return await transcribe(buffer, mimeType);
  } catch (err) {
    console.error('Voice transcription error:', err.message);
    return null;
  }
}

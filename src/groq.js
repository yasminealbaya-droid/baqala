import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Chat via Groq LLaMA 3.3 70B — fast, free tier (30 RPM).
 * Drop-in replacement for Gemini chat when GEMINI_API_KEY=mock.
 */
export async function chat(systemPrompt, history, opts = {}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
  ];
  const result = await groq.chat.completions.create({
    model: opts.model || 'llama-3.3-70b-versatile',
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 500,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
  });
  return result.choices[0]?.message?.content || '';
}

/**
 * Extract structured JSON via Groq.
 */
export async function extractJSON(systemPrompt, userText) {
  return chat(systemPrompt, [{ role: 'user', content: userText }], {
    temperature: 0.1, maxTokens: 1000, json: true,
  });
}

/**
 * Transcribe audio via Groq Whisper large-v3 (free: 30 RPM).
 * @param {Buffer} audioBuffer - raw audio bytes
 * @param {string} mimeType - e.g. 'audio/ogg'
 * @returns {string|null} transcription text
 */
export async function transcribe(audioBuffer, mimeType) {
  try {
    const file = new File([audioBuffer], 'voice.ogg', { type: mimeType || 'audio/ogg' });

    const result = await groq.audio.transcriptions.create({
      model: 'whisper-large-v3',
      file,
      language: 'ar',
      prompt: 'هلا، شلونك، شكد، شنو، اكو، ماكو، طماطة، بطاطا، دجاج، رز، كيلو، دينار، الف',
    });
    return result.text || null;
  } catch (err) {
    console.error('Groq Whisper error:', err.message);
    return null;
  }
}

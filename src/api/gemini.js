const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
];

const GEMINI_VISION_MODEL = 'gemini-2.5-flash';

/**
 * Calls the Gemini API with a system prompt and user message.
 * @param {string} apiKey
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @returns {Promise<string>} The text response
 */
/**
 * Attempts the request against each model in order, falling back on quota errors.
 * @param {string} apiKey
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @returns {Promise<string>} The text response
 */
export async function callGemini(apiKey, systemPrompt, userMessage) {
  let lastError;

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Gemini returned an empty response.');
      return text;
    }

    const errorBody = await response.json().catch(() => ({}));
    const message =
      errorBody?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
    const isQuotaError = response.status === 429 || message.toLowerCase().includes('quota');

    if (isQuotaError) {
      lastError = new Error(`Quota exceeded on ${model}, tried all available models.`);
      continue;
    }

    throw new Error(message);
  }

  throw lastError;
}

/**
 * Sends an image to Gemini and returns the analysis text.
 * @param {string} apiKey
 * @param {string} base64
 * @param {string} mediaType  e.g. 'image/jpeg'
 * @param {string} prompt
 * @returns {Promise<string>}
 */
export async function analyzeImageGemini(apiKey, base64, mediaType, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: mediaType, data: base64 } },
          { text: prompt },
        ],
      }],
      generationConfig: { maxOutputTokens: 1024 },
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned an empty response.');
  return text;
}

/**
 * Sends a PDF document to Gemini as inline data alongside a text prompt.
 * @param {string} apiKey
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {string} pdfBase64
 * @returns {Promise<string>}
 */
export async function callGeminiWithPDF(apiKey, systemPrompt, userMessage, pdfBase64) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } },
          { text: userMessage },
        ],
      }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned an empty response.');
  return text;
}

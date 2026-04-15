const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];

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

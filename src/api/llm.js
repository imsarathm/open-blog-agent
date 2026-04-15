/** @typedef {'groq' | 'gemini' | 'claude' | 'gpt'} Provider */

export const PROVIDERS = {
  groq: {
    label: 'Groq — Llama 3.3 70B',
    hint: 'Free key at console.groq.com',
    model: 'llama-3.3-70b-versatile',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    type: 'openai',
  },
  gemini: {
    label: 'Gemini 2.0 Flash',
    hint: 'Key at aistudio.google.com',
    model: 'gemini-2.0-flash',
    type: 'gemini',
  },
  claude: {
    label: 'Claude Sonnet 4.6',
    hint: 'Key at console.anthropic.com',
    model: 'claude-sonnet-4-6',
    url: 'https://api.anthropic.com/v1/messages',
    type: 'claude',
  },
  gpt: {
    label: 'GPT-4o mini',
    hint: 'Key at platform.openai.com',
    model: 'gpt-4o-mini',
    url: 'https://api.openai.com/v1/chat/completions',
    type: 'openai',
  },
};

/**
 * Calls an LLM provider with a system prompt and user message.
 * @param {Provider} provider
 * @param {string} apiKey
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @returns {Promise<string>}
 */
export async function callLLM(provider, apiKey, systemPrompt, userMessage) {
  const config = PROVIDERS[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);

  if (config.type === 'openai') return callOpenAICompat(config, apiKey, systemPrompt, userMessage);
  if (config.type === 'claude') return callClaude(config, apiKey, systemPrompt, userMessage);
  return callGemini(config, apiKey, systemPrompt, userMessage);
}

/**
 * OpenAI-compatible endpoint (Groq, GPT).
 */
async function callOpenAICompat(config, apiKey, systemPrompt, userMessage) {
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      errorBody?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Provider returned an empty response.');
  return text;
}

/**
 * Anthropic Messages API.
 */
async function callClaude(config, apiKey, systemPrompt, userMessage) {
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      errorBody?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Claude returned an empty response.');
  return text;
}

/**
 * Google Gemini REST API.
 */
async function callGemini(config, apiKey, systemPrompt, userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      errorBody?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned an empty response.');
  return text;
}

/** @typedef {'groq' | 'openai' | 'anthropic'} Provider */

export const PROVIDERS = {
  groq: {
    label: 'Groq — Llama 3.3 70B',
    hint: 'Free key at console.groq.com',
    model: 'llama-3.3-70b-versatile',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    type: 'openai',
    supportsVision: false,
  },
  openai: {
    label: 'OpenAI — GPT-4o mini',
    hint: 'Key at platform.openai.com',
    model: 'gpt-4o-mini',
    url: 'https://api.openai.com/v1/chat/completions',
    type: 'openai',
    supportsVision: true,
  },
  anthropic: {
    label: 'Anthropic — Claude Sonnet',
    hint: 'Key at console.anthropic.com',
    model: 'claude-sonnet-4-6',
    url: 'https://api.anthropic.com/v1/messages',
    type: 'anthropic',
    supportsVision: true,
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

  if (config.type === 'openai')     return callOpenAICompat(config, apiKey, systemPrompt, userMessage);
  if (config.type === 'anthropic')  return callAnthropic(config, apiKey, systemPrompt, userMessage);
  throw new Error(`Unsupported provider type: ${config.type}`);
}

/**
 * Sends an image to a vision-capable provider and returns the analysis text.
 * @param {Provider} provider
 * @param {string} apiKey
 * @param {string} base64
 * @param {string} mediaType  e.g. 'image/jpeg'
 * @param {string} prompt
 * @returns {Promise<string>}
 */
export async function analyzeImage(provider, apiKey, base64, mediaType, prompt) {
  const config = PROVIDERS[provider];
  if (!config?.supportsVision) throw new Error(`${provider} does not support vision.`);

  if (provider === 'openai') {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}` } },
            { type: 'text', text: prompt },
          ],
        }],
        max_tokens: 1024,
      }),
    });
    return extractOpenAIText(response);
  }

  if (provider === 'anthropic') {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
    return extractAnthropicText(response);
  }

  throw new Error(`Vision not implemented for ${provider}`);
}

// ── Internal callers ──────────────────────────────────────────────────────────

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
  return extractOpenAIText(response);
}

async function callAnthropic(config, apiKey, systemPrompt, userMessage) {
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
  return extractAnthropicText(response);
}

// ── Response extractors ───────────────────────────────────────────────────────

async function extractOpenAIText(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Provider returned an empty response.');
  return text;
}

async function extractAnthropicText(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Anthropic returned an empty response.');
  return text;
}

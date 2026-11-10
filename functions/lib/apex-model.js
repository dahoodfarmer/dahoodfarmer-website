import { APEX_MODEL as CLOUDFLARE_DEFAULT_MODEL } from './apex.js';

function normalizeUsage(usage = {}) {
  return {
    prompt_tokens: Number(usage.prompt_tokens ?? usage.input_tokens ?? 0),
    completion_tokens: Number(usage.completion_tokens ?? usage.output_tokens ?? 0)
  };
}

async function readJson(response, provider) {
  let data;
  try { data = await response.json(); }
  catch { throw new Error(provider + ' returned an unreadable response.'); }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || (provider + ' request failed with status ' + response.status);
    throw new Error(String(message).slice(0, 400));
  }
  return data;
}

function extractOpenAIText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of data.output || []) {
    if (item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

export async function runApexModel(env, messages, options = {}, fetchImpl = fetch) {
  const provider = String(env.APEX_PROVIDER || 'cloudflare').toLowerCase();
  const maxTokens = Math.min(1200, Math.max(100, Number(options.maxTokens || 600)));
  const temperature = Number.isFinite(options.temperature) ? options.temperature : 0.35;

  if (provider === 'cloudflare') {
    if (!env.AI) throw new Error('Cloudflare Workers AI binding is not configured.');
    const model = env.APEX_MODEL || CLOUDFLARE_DEFAULT_MODEL;
    const result = await env.AI.run(model, {
      messages,
      max_tokens: maxTokens,
      temperature,
      top_p: options.topP ?? 0.85
    });
    return {
      provider,
      model,
      response: typeof result?.response === 'string' ? result.response.trim() : '',
      usage: normalizeUsage(result?.usage)
    };
  }

  if (provider === 'openai') {
    if (!env.OPENAI_API_KEY) throw new Error('OpenAI API key is not configured.');
    const model = env.OPENAI_MODEL || 'gpt-6.1-sol';
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.OPENAI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        input: messages,
        max_output_tokens: maxTokens,
        reasoning: { effort: env.APEX_REASONING_EFFORT || 'medium' },
        store: false
      })
    });
    const data = await readJson(response, 'OpenAI');
    return {
      provider,
      model: data.model || model,
      response: extractOpenAIText(data),
      usage: normalizeUsage(data.usage)
    };
  }

  if (provider === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY) throw new Error('Anthropic API key is not configured.');
    const model = env.ANTHROPIC_MODEL;
    if (!model) throw new Error('Anthropic model ID is not configured.');
    const system = messages.find(item => item.role === 'system')?.content || '';
    const conversation = messages.filter(item => item.role === 'user' || item.role === 'assistant');
    const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: conversation,
        temperature,
        top_p: options.topP ?? 0.85
      })
    });
    const data = await readJson(response, 'Anthropic');
    const answer = (data.content || []).filter(item => item.type === 'text').map(item => item.text).join('\n').trim();
    return {
      provider,
      model: data.model || model,
      response: answer,
      usage: normalizeUsage({ input_tokens: data.usage?.input_tokens, output_tokens: data.usage?.output_tokens })
    };
  }

  throw new Error('Unsupported APEX model provider: ' + provider);
}

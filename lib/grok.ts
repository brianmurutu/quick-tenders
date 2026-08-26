/** Lightweight xAI Grok client using its OpenAI-compatible Chat Completions API. */

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions'
const TIMEOUT_MS = 60_000

type Message = { role: 'system' | 'user'; content: string }

type GrokResponse = {
  choices?: Array<{ message?: { content?: string | null } }>
  error?: { message?: string }
}

export type GrokClient = {
  completeJson(system: string, prompt: string, maxTokens?: number): Promise<unknown>
}

export function grokModel(): string {
  return process.env.GROK_MODEL?.trim() || 'grok-4.6'
}

export function createGrokClient(): GrokClient {
  const apiKey = process.env.XAI_API_KEY?.trim()
  if (!apiKey) throw new Error('Missing XAI_API_KEY. Tender AI work cannot run without it.')

  async function completeJson(system: string, prompt: string, maxTokens = 4096): Promise<unknown> {
    const messages: Message[] = [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ]
    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: grokModel(),
        messages,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const payload = (await response.json().catch(() => null)) as GrokResponse | null
    if (!response.ok) throw new Error(payload?.error?.message ?? `Grok request failed: HTTP ${response.status}`)

    const content = payload?.choices?.[0]?.message?.content
    if (!content) throw new Error('Grok returned no completion content')
    try {
      return JSON.parse(content)
    } catch {
      throw new Error('Grok returned invalid JSON')
    }
  }

  return { completeJson }
}

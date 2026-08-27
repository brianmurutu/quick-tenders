/**
 * The LLM client behind tender matching and bid drafting.
 *
 * Both providers speak the OpenAI Chat Completions shape, so one small fetch
 * wrapper covers them and switching is a matter of which API key is present. No
 * SDK, matching the Resend and TextSMS clients: nothing here needs streaming,
 * tools or retries beyond what the callers already do.
 *
 * WHY TWO PROVIDERS
 *
 * xAI was first, but an xAI team with no credits returns 403 on every call with
 * "your newly created team doesn't have any credits or licenses yet", which takes
 * the whole pipeline down — no scores, no documents, no emails. Groq has a free
 * tier and the same request shape, so it is the default when its key is set.
 * Nothing above this module knows or cares which one answered.
 */

export type AiProviderId = 'groq' | 'xai'

type ProviderSpec = {
  readonly id: AiProviderId
  readonly label: string
  readonly endpoint: string
  /** Env var holding the API key. Its presence is what selects a provider. */
  readonly keyEnv: string
  /** Env var overriding the model. */
  readonly modelEnv: string
  readonly defaultModel: string
  /**
   * Groq renamed max_tokens to max_completion_tokens and warns on the old name;
   * xAI only knows max_tokens. Sending the right one avoids a needless rejection.
   */
  readonly maxTokensField: 'max_tokens' | 'max_completion_tokens'
  /** Where a human goes to fix a key or billing problem. */
  readonly consoleUrl: string
}

/**
 * Order matters: the first provider with a key set wins when AI_PROVIDER is
 * unset. Groq leads because it is the one with a working free tier.
 */
const PROVIDERS: readonly ProviderSpec[] = [
  {
    id: 'groq',
    label: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    keyEnv: 'GROQ_API_KEY',
    modelEnv: 'GROQ_MODEL',
    defaultModel: 'llama-3.3-70b-versatile',
    maxTokensField: 'max_completion_tokens',
    consoleUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'xai',
    label: 'xAI Grok',
    endpoint: 'https://api.x.ai/v1/chat/completions',
    keyEnv: 'XAI_API_KEY',
    modelEnv: 'GROK_MODEL',
    defaultModel: 'grok-4.6',
    maxTokensField: 'max_tokens',
    consoleUrl: 'https://console.x.ai',
  },
]

const TIMEOUT_MS = 60_000

type Message = { role: 'system' | 'user'; content: string }

type CompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>
  error?: { message?: string } | string
}

export type AiClient = {
  readonly provider: AiProviderId
  readonly model: string
  completeJson(system: string, prompt: string, maxTokens?: number): Promise<unknown>
}

function specFor(id: AiProviderId): ProviderSpec {
  const spec = PROVIDERS.find((provider) => provider.id === id)

  if (!spec) {
    throw new Error(
      `Unknown AI_PROVIDER "${id}". Valid values: ${PROVIDERS.map((p) => p.id).join(', ')}.`,
    )
  }

  return spec
}

function hasKey(spec: ProviderSpec): boolean {
  return Boolean(process.env[spec.keyEnv]?.trim())
}

/**
 * Which provider this deployment uses.
 *
 * AI_PROVIDER pins it explicitly. Otherwise the first provider with a key set
 * wins, so dropping GROQ_API_KEY into .env.local is enough to switch and removing
 * it is enough to switch back.
 */
export function resolveAiProvider(): ProviderSpec {
  const pinned = process.env.AI_PROVIDER?.trim().toLowerCase()

  if (pinned) return specFor(pinned as AiProviderId)

  const available = PROVIDERS.find(hasKey)

  if (available) return available

  throw new Error(
    'No AI provider is configured. Set one of ' +
      PROVIDERS.map((p) => `${p.keyEnv} (${p.label}, ${p.consoleUrl})`).join(' or ') +
      '. Tender matching and bid drafting cannot run without it.',
  )
}

/** The model in use, for run summaries and logs. */
export function aiModel(): string {
  const spec = resolveAiProvider()

  return process.env[spec.modelEnv]?.trim() || spec.defaultModel
}

/** "Groq / llama-3.3-70b-versatile", for a one-line description in a summary. */
export function aiDescription(): string {
  const spec = resolveAiProvider()

  return `${spec.label} / ${process.env[spec.modelEnv]?.trim() || spec.defaultModel}`
}

/** True when at least one provider has a key, without throwing. */
export function aiConfigured(): boolean {
  try {
    resolveAiProvider()

    return true
  } catch {
    return false
  }
}

/** Explains a false aiConfigured() to whoever reads a run summary. */
export function aiConfigHint(): string {
  try {
    const spec = resolveAiProvider()

    return hasKey(spec)
      ? `AI is configured: ${spec.label}`
      : `AI_PROVIDER is pinned to ${spec.id} but ${spec.keyEnv} is not set`
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

function errorMessage(payload: CompletionResponse | null, status: number): string {
  const raw = payload?.error

  if (typeof raw === 'string') return raw
  if (raw?.message) return raw.message

  return `HTTP ${status}`
}

export function createAiClient(): AiClient {
  const spec = resolveAiProvider()
  const apiKey = process.env[spec.keyEnv]?.trim()

  if (!apiKey) {
    throw new Error(
      `Missing ${spec.keyEnv}. ${spec.label} is the selected AI provider, so tender ` +
        `matching and bid drafting cannot run. Get a key at ${spec.consoleUrl}.`,
    )
  }

  const model = process.env[spec.modelEnv]?.trim() || spec.defaultModel

  async function completeJson(
    system: string,
    prompt: string,
    maxTokens = 4096,
  ): Promise<unknown> {
    const messages: Message[] = [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ]

    const response = await fetch(spec.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        [spec.maxTokensField]: maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const payload = (await response
      .json()
      .catch(() => null)) as CompletionResponse | null

    if (!response.ok) {
      // Naming the provider matters: "403" from an unspecified service is the
      // kind of log line that costs an hour to diagnose.
      throw new Error(
        `${spec.label} (${model}) rejected the request: ${errorMessage(payload, response.status)}`,
      )
    }

    const content = payload?.choices?.[0]?.message?.content

    if (!content) throw new Error(`${spec.label} returned no completion content`)

    try {
      return JSON.parse(content)
    } catch {
      throw new Error(`${spec.label} returned invalid JSON`)
    }
  }

  return { provider: spec.id, model, completeJson }
}

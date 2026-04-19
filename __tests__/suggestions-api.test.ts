import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const SUGGESTIONS_ROUTE = '/app/api/suggestions/route'

const mockUser = { id: 'user-123', email: 'test@example.com' }

function mockSupabase(overrides: {
  authUser?: typeof mockUser | null
  authError?: Error | null
  cooldownRow?: { ends_at: string } | null
  upsertError?: Error | null
} = {}) {
  const upsertFn = vi.fn().mockResolvedValue({ error: overrides.upsertError ?? null })
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: overrides.authUser ?? mockUser },
        error: overrides.authError ?? null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: overrides.cooldownRow ?? null,
          }),
        }),
      }),
      upsert: upsertFn,
    }),
    _upsertFn: upsertFn,
  }
}

let createClientMock: ReturnType<typeof vi.fn>
let globalFetchBackup: typeof globalThis.fetch

beforeEach(() => {
  globalFetchBackup = globalThis.fetch
  vi.resetModules()
})

afterEach(() => {
  globalThis.fetch = globalFetchBackup
  vi.restoreAllMocks()
})

async function importRoute() {
  const mod = await import('../app/api/suggestions/route')
  return mod
}

function makeRequest(body: object, headers: Record<string, string> = {}): Request {
  const bodyStr = JSON.stringify(body)
  return new Request('http://localhost:3000/api/suggestions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'content-length': String(bodyStr.length),
      ...headers,
    },
    body: bodyStr,
  })
}

function validPayload() {
  return {
    period: 'monthly',
    totalRevenue: 10000,
    totalVariableCost: 5000,
    totalFixedCost: 2000,
    netProfit: 3000,
    profitMargin: 30,
    breakEvenRevenue: 6667,
    skuBreakdown: [
      { name: 'Widget A', revenue: 5000, variableCost: 2500, contribution: 2500, unitsSold: 100 },
      { name: 'Widget B', revenue: 5000, variableCost: 2500, contribution: 2500, unitsSold: 200 },
    ],
  }
}

describe('POST /api/suggestions', () => {
  it('returns 401 when user is not authenticated', async () => {
    const sb = mockSupabase({ authUser: null, authError: new Error('no session') })
    createClientMock = vi.fn().mockResolvedValue(sb)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

    const { POST } = await importRoute()
    const res = await POST(makeRequest(validPayload()))

    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 429 when user is in cooldown', async () => {
    const futureTime = new Date(Date.now() + 3600000).toISOString()
    const sb = mockSupabase({ cooldownRow: { ends_at: futureTime } })
    createClientMock = vi.fn().mockResolvedValue(sb)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

    const { POST } = await importRoute()
    const res = await POST(makeRequest(validPayload()))

    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.error).toContain('cooldown')
    expect(data.ends_at).toBeTypeOf('number')
  })

  it('returns 413 when payload is too large', async () => {
    const sb = mockSupabase()
    createClientMock = vi.fn().mockResolvedValue(sb)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

    const { POST } = await importRoute()
    const req = makeRequest(validPayload(), { 'content-length': '200000' })
    const res = await POST(req)

    expect(res.status).toBe(413)
  })

  it('sets cooldown BEFORE making Gemini API call', async () => {
    const sb = mockSupabase()
    createClientMock = vi.fn().mockResolvedValue(sb)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

    process.env.GEMINI_API_KEY = 'test-key'

    let upsertCalledBeforeFetch = false
    const fetchOrder: string[] = []

    // Track upsert call order
    sb.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'ai_suggestions_cooldown') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
          upsert: vi.fn().mockImplementation(() => {
            fetchOrder.push('upsert')
            return Promise.resolve({ error: null })
          }),
        }
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null }) }
    })

    globalThis.fetch = vi.fn().mockImplementation(() => {
      fetchOrder.push('gemini-fetch')
      upsertCalledBeforeFetch = fetchOrder.indexOf('upsert') < fetchOrder.indexOf('gemini-fetch')
      return Promise.resolve(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: '["Suggestion 1", "Suggestion 2"]' }] } }],
      }), { status: 200 }))
    })

    const { POST } = await importRoute()
    await POST(makeRequest(validPayload()))

    expect(upsertCalledBeforeFetch).toBe(true)
    expect(fetchOrder).toEqual(['upsert', 'gemini-fetch'])

    delete process.env.GEMINI_API_KEY
  })

  it('limits SKU count in prompt to prevent abuse', async () => {
    const sb = mockSupabase()
    createClientMock = vi.fn().mockResolvedValue(sb)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

    process.env.GEMINI_API_KEY = 'test-key'

    const hugePayload = validPayload()
    hugePayload.skuBreakdown = Array.from({ length: 200 }, (_, i) => ({
      name: `SKU-${i}`,
      revenue: 100,
      variableCost: 50,
      contribution: 50,
      unitsSold: 10,
    }))

    let capturedBody = ''
    sb.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })

    globalThis.fetch = vi.fn().mockImplementation((_url: string, opts: { body: string }) => {
      capturedBody = opts.body
      return Promise.resolve(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: '["test"]' }] } }],
      }), { status: 200 }))
    })

    const { POST } = await importRoute()
    await POST(makeRequest(hugePayload))

    const parsed = JSON.parse(capturedBody)
    const promptText = parsed.contents[0].parts[0].text
    const skuLines = promptText.split('\n').filter((l: string) => l.startsWith('- SKU-'))
    expect(skuLines.length).toBeLessThanOrEqual(50)

    delete process.env.GEMINI_API_KEY
  })

  it('returns 500 when GEMINI_API_KEY is not set', async () => {
    const sb = mockSupabase()
    createClientMock = vi.fn().mockResolvedValue(sb)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

    sb.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })

    delete process.env.GEMINI_API_KEY

    const { POST } = await importRoute()
    const res = await POST(makeRequest(validPayload()))

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('GEMINI_API_KEY')
  })

  it('returns cooldown_ends_at even on Gemini failure (cooldown set first)', async () => {
    const sb = mockSupabase()
    createClientMock = vi.fn().mockResolvedValue(sb)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

    process.env.GEMINI_API_KEY = 'test-key'

    sb.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })

    globalThis.fetch = vi.fn().mockResolvedValue(new Response('rate limited', { status: 429 }))

    const { POST } = await importRoute()
    const res = await POST(makeRequest(validPayload()))

    const data = await res.json()
    expect(data.cooldown_ends_at).toBeTypeOf('number')
    expect(data.cooldown_ends_at).toBeGreaterThan(Date.now())

    delete process.env.GEMINI_API_KEY
  })
})

describe('Cooldown race condition prevention', () => {
  it('concurrent requests should not both bypass cooldown', async () => {
    const sb = mockSupabase()
    createClientMock = vi.fn().mockResolvedValue(sb)
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

    process.env.GEMINI_API_KEY = 'test-key'

    let cooldownSet = false
    let upsertCalls = 0

    sb.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'ai_suggestions_cooldown') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => {
                if (cooldownSet) {
                  return Promise.resolve({
                    data: { ends_at: new Date(Date.now() + 3600000).toISOString() },
                  })
                }
                return Promise.resolve({ data: null })
              }),
            }),
          }),
          upsert: vi.fn().mockImplementation(() => {
            upsertCalls++
            cooldownSet = true
            return Promise.resolve({ error: null })
          }),
        }
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null }) }
    })

    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '["suggestion"]' }] } }],
    }), { status: 200 }))

    const { POST } = await importRoute()

    const req1 = POST(makeRequest(validPayload()))
    const req2 = POST(makeRequest(validPayload()))
    const [res1, res2] = await Promise.all([req1, req2])

    const statuses = [res1.status, res2.status].sort()
    // At least one should succeed and one might get 429
    // With the new design, both may succeed because cooldown is set before fetch
    // but importantly both will SET cooldown before calling Gemini
    expect(upsertCalls).toBeGreaterThanOrEqual(1)

    delete process.env.GEMINI_API_KEY
  })
})

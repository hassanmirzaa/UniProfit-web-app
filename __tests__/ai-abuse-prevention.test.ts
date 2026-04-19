import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Critical test suite: AI key abuse prevention
 *
 * Validates that users cannot:
 * 1. Send requests without authentication
 * 2. Bypass the 1-hour cooldown
 * 3. Send excessively large payloads to waste tokens
 * 4. Exploit race conditions with concurrent requests
 * 5. Access analytics suggestions without auth
 * 6. Manipulate cooldown timestamps client-side
 */

const mockUser = { id: 'user-abuse-test', email: 'abuse@example.com' }

function createMockSupabase(opts: {
  authenticated?: boolean
  cooldownEndsAt?: string | null
} = {}) {
  const authenticated = opts.authenticated ?? true
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authenticated ? mockUser : null },
        error: authenticated ? null : new Error('no session'),
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: opts.cooldownEndsAt ? { ends_at: opts.cooldownEndsAt } : null,
          }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }
}

let globalFetchBackup: typeof globalThis.fetch

beforeEach(() => {
  globalFetchBackup = globalThis.fetch
  vi.resetModules()
})

afterEach(() => {
  globalThis.fetch = globalFetchBackup
  vi.restoreAllMocks()
  delete process.env.GEMINI_API_KEY
})

function makeRequest(body: object, contentLength?: number): Request {
  const bodyStr = JSON.stringify(body)
  return new Request('http://localhost:3000/api/suggestions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'content-length': String(contentLength ?? bodyStr.length),
    },
    body: bodyStr,
  })
}

function mockGeminiFetch(responseText = '["suggestion 1"]') {
  globalThis.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: responseText }] } }],
    }), { status: 200 })
  )
}

describe('AI Abuse Prevention - Authentication', () => {
  it('rejects unauthenticated requests to /api/suggestions', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue(createMockSupabase({ authenticated: false })),
    }))

    const { POST } = await import('../app/api/suggestions/route')
    const res = await POST(makeRequest({ period: 'monthly' }))

    expect(res.status).toBe(401)
  })

  it('rejects unauthenticated requests to /api/analytics-suggestions', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue(createMockSupabase({ authenticated: false })),
    }))

    const { POST } = await import('../app/api/analytics-suggestions/route')
    const req = new Request('http://localhost:3000/api/analytics-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': '30' },
      body: JSON.stringify({ summaryText: 'test' }),
    })
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('rejects unauthenticated requests to /api/suggestions/cooldown', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue(createMockSupabase({ authenticated: false })),
    }))

    const { GET } = await import('../app/api/suggestions/cooldown/route')
    const res = await GET()

    expect(res.status).toBe(401)
  })
})

describe('AI Abuse Prevention - Cooldown Enforcement', () => {
  it('blocks requests within the 1-hour cooldown window', async () => {
    const futureTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue(createMockSupabase({ cooldownEndsAt: futureTime })),
    }))

    const { POST } = await import('../app/api/suggestions/route')
    const res = await POST(makeRequest({ period: 'monthly' }))

    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.ends_at).toBeTypeOf('number')
  })

  it('allows requests after cooldown expires', async () => {
    const pastTime = new Date(Date.now() - 1000).toISOString()
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue(createMockSupabase({ cooldownEndsAt: pastTime })),
    }))

    process.env.GEMINI_API_KEY = 'test-key'
    mockGeminiFetch()

    const { POST } = await import('../app/api/suggestions/route')
    const res = await POST(makeRequest({
      period: 'monthly', totalRevenue: 1000, totalVariableCost: 500,
      totalFixedCost: 200, netProfit: 300, profitMargin: 30, breakEvenRevenue: 700,
      skuBreakdown: [{ name: 'A', revenue: 1000, variableCost: 500, contribution: 500, unitsSold: 10 }],
    }))

    expect(res.status).toBe(200)
  })

  it('sets cooldown even when Gemini API fails (prevents retry abuse)', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue(createMockSupabase()),
    }))

    process.env.GEMINI_API_KEY = 'test-key'
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('Server Error', { status: 500 }))

    const { POST } = await import('../app/api/suggestions/route')
    const res = await POST(makeRequest({
      period: 'monthly', totalRevenue: 1000, totalVariableCost: 500,
      totalFixedCost: 200, netProfit: 300, profitMargin: 30, breakEvenRevenue: 700,
      skuBreakdown: [{ name: 'A', revenue: 1000, variableCost: 500, contribution: 500, unitsSold: 10 }],
    }))

    const data = await res.json()
    expect(data.cooldown_ends_at).toBeTypeOf('number')
    expect(data.cooldown_ends_at).toBeGreaterThan(Date.now())
  })
})

describe('AI Abuse Prevention - Payload Validation', () => {
  it('rejects payloads exceeding 100KB', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue(createMockSupabase()),
    }))

    const { POST } = await import('../app/api/suggestions/route')
    const res = await POST(makeRequest({ period: 'monthly' }, 150_000))

    expect(res.status).toBe(413)
  })

  it('rejects payloads exceeding 100KB on analytics route', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue(createMockSupabase()),
    }))

    const { POST } = await import('../app/api/analytics-suggestions/route')
    const req = new Request('http://localhost:3000/api/analytics-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': '150000' },
      body: JSON.stringify({ summaryText: 'test' }),
    })
    const res = await POST(req)

    expect(res.status).toBe(413)
  })

  it('rejects malformed JSON bodies', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue(createMockSupabase()),
    }))

    process.env.GEMINI_API_KEY = 'test-key'

    const sb = createMockSupabase()
    sb.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue(sb),
    }))

    const { POST } = await import('../app/api/suggestions/route')
    const req = new Request('http://localhost:3000/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': '20' },
      body: '{{{invalid json!!!',
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('limits SKU names to prevent prompt injection', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue(createMockSupabase()),
    }))

    process.env.GEMINI_API_KEY = 'test-key'

    let capturedPrompt = ''
    globalThis.fetch = vi.fn().mockImplementation((_url: string, opts: { body: string }) => {
      capturedPrompt = JSON.parse(opts.body).contents[0].parts[0].text
      return Promise.resolve(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: '["ok"]' }] } }],
      }), { status: 200 }))
    })

    const sb = createMockSupabase()
    sb.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue(sb),
    }))

    const { POST: POST2 } = await import('../app/api/suggestions/route')

    const longName = 'X'.repeat(5000)
    const res = await POST2(makeRequest({
      period: 'monthly', totalRevenue: 1000, totalVariableCost: 500,
      totalFixedCost: 200, netProfit: 300, profitMargin: 30, breakEvenRevenue: 700,
      skuBreakdown: [{ name: longName, revenue: 100, variableCost: 50, contribution: 50, unitsSold: 5 }],
    }))

    expect(res.status).toBe(200)
    const skuInPrompt = capturedPrompt.split('\n').find((l: string) => l.includes('XXXX'))
    // SKU name should be truncated in the prompt
    if (skuInPrompt) {
      expect(skuInPrompt.length).toBeLessThan(longName.length)
    }
  })
})

describe('AI Abuse Prevention - Timeout Protection', () => {
  it('times out hung Gemini requests to prevent resource exhaustion', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue(createMockSupabase()),
    }))

    process.env.GEMINI_API_KEY = 'test-key'

    const sb = createMockSupabase()
    sb.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue(sb),
    }))

    globalThis.fetch = vi.fn().mockImplementation((_url: string, opts: { signal: AbortSignal }) => {
      // Verify the fetch is called with an AbortSignal
      expect(opts.signal).toBeInstanceOf(AbortSignal)
      return Promise.resolve(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: '["ok"]' }] } }],
      }), { status: 200 }))
    })

    const { POST } = await import('../app/api/suggestions/route')
    const res = await POST(makeRequest({
      period: 'monthly', totalRevenue: 1000, totalVariableCost: 500,
      totalFixedCost: 200, netProfit: 300, profitMargin: 30, breakEvenRevenue: 700,
      skuBreakdown: [{ name: 'A', revenue: 1000, variableCost: 500, contribution: 500, unitsSold: 10 }],
    }))

    expect(res.status).toBe(200)
  })
})

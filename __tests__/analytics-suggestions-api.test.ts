import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockUser = { id: 'user-xyz', email: 'test@example.com' }

function mockSupabase(overrides: {
  authUser?: typeof mockUser | null
  authError?: Error | null
} = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: overrides.authUser ?? mockUser },
        error: overrides.authError ?? null,
      }),
    },
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
  return await import('../app/api/analytics-suggestions/route')
}

function makeRequest(body: object, headers: Record<string, string> = {}): Request {
  const bodyStr = JSON.stringify(body)
  return new Request('http://localhost:3000/api/analytics-suggestions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'content-length': String(bodyStr.length),
      ...headers,
    },
    body: bodyStr,
  })
}

describe('POST /api/analytics-suggestions', () => {
  it('returns 401 when user is not authenticated', async () => {
    createClientMock = vi.fn().mockResolvedValue(mockSupabase({ authUser: null, authError: new Error('no') }))
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

    const { POST } = await importRoute()
    const res = await POST(makeRequest({ summaryText: 'test' }))

    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 413 when payload exceeds size limit', async () => {
    createClientMock = vi.fn().mockResolvedValue(mockSupabase())
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

    const { POST } = await importRoute()
    const res = await POST(makeRequest({ summaryText: 'test' }, { 'content-length': '200000' }))

    expect(res.status).toBe(413)
  })

  it('returns 400 for invalid JSON body', async () => {
    createClientMock = vi.fn().mockResolvedValue(mockSupabase())
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

    process.env.GEMINI_API_KEY = 'test-key'

    const { POST } = await importRoute()
    const req = new Request('http://localhost:3000/api/analytics-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'content-length': '10' },
      body: 'invalid{{{',
    })
    const res = await POST(req)

    expect(res.status).toBe(400)

    delete process.env.GEMINI_API_KEY
  })

  it('truncates overly long summaryText to prevent token abuse', async () => {
    createClientMock = vi.fn().mockResolvedValue(mockSupabase())
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

    process.env.GEMINI_API_KEY = 'test-key'

    const longText = 'A'.repeat(50000)
    let capturedBody = ''
    globalThis.fetch = vi.fn().mockImplementation((_url: string, opts: { body: string }) => {
      capturedBody = opts.body
      return Promise.resolve(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: '["insight"]' }] } }],
      }), { status: 200 }))
    })

    const { POST } = await importRoute()
    await POST(makeRequest({ summaryText: longText }))

    const parsed = JSON.parse(capturedBody)
    const promptText = parsed.contents[0].parts[0].text
    expect(promptText.length).toBeLessThan(longText.length)

    delete process.env.GEMINI_API_KEY
  })

  it('returns suggestions on valid request', async () => {
    createClientMock = vi.fn().mockResolvedValue(mockSupabase())
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

    process.env.GEMINI_API_KEY = 'test-key'

    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '["Focus on margins.", "Cut costs."]' }] } }],
    }), { status: 200 }))

    const { POST } = await importRoute()
    const res = await POST(makeRequest({ summaryText: 'Some monthly data.' }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.suggestions).toBeInstanceOf(Array)
    expect(data.suggestions.length).toBeGreaterThan(0)

    delete process.env.GEMINI_API_KEY
  })
})

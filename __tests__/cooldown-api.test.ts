import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockUser = { id: 'user-abc', email: 'test@example.com' }

function mockSupabase(overrides: {
  authUser?: typeof mockUser | null
  authError?: Error | null
  cooldownRow?: { ends_at: string } | null
} = {}) {
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
    }),
  }
}

let createClientMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function importRoute() {
  return await import('../app/api/suggestions/cooldown/route')
}

describe('GET /api/suggestions/cooldown', () => {
  it('returns 401 for unauthenticated users', async () => {
    createClientMock = vi.fn().mockResolvedValue(mockSupabase({ authUser: null, authError: new Error('no session') }))
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

    const { GET } = await importRoute()
    const res = await GET()

    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns in_cooldown=false when no cooldown exists', async () => {
    createClientMock = vi.fn().mockResolvedValue(mockSupabase({ cooldownRow: null }))
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

    const { GET } = await importRoute()
    const res = await GET()

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.in_cooldown).toBe(false)
    expect(data.ends_at).toBeUndefined()
  })

  it('returns in_cooldown=true with ends_at when cooldown is active', async () => {
    const futureTime = new Date(Date.now() + 3600000).toISOString()
    createClientMock = vi.fn().mockResolvedValue(mockSupabase({ cooldownRow: { ends_at: futureTime } }))
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

    const { GET } = await importRoute()
    const res = await GET()

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.in_cooldown).toBe(true)
    expect(data.ends_at).toBeTypeOf('number')
    expect(data.ends_at).toBeGreaterThan(Date.now())
  })

  it('returns in_cooldown=false when cooldown has expired', async () => {
    const pastTime = new Date(Date.now() - 1000).toISOString()
    createClientMock = vi.fn().mockResolvedValue(mockSupabase({ cooldownRow: { ends_at: pastTime } }))
    vi.doMock('@/lib/supabase/server', () => ({ createClient: createClientMock }))

    const { GET } = await importRoute()
    const res = await GET()

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.in_cooldown).toBe(false)
  })
})

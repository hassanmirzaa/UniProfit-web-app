export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: row } = await supabase
    .from('ai_suggestions_cooldown')
    .select('ends_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const now = Date.now()
  const endsAtMs = row?.ends_at ? new Date(row.ends_at).getTime() : 0
  const inCooldown = endsAtMs > now

  return NextResponse.json({
    in_cooldown: inCooldown,
    ...(inCooldown && { ends_at: endsAtMs }),
  })
}

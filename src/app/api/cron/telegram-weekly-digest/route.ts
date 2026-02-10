import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendMessage } from '@/lib/telegram'
import { buildWeeklyDigestMessage } from '@/lib/telegram-insights'

function dateString(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date()
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)
  const startStr = dateString(start)
  const endStr = dateString(end)

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, telegram_chat_id')
    .not('telegram_chat_id', 'is', null)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  let sent = 0

  for (const profile of profiles || []) {
    const chatId = Number(profile.telegram_chat_id)
    if (!Number.isFinite(chatId)) continue

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, description, categories(name)')
      .eq('user_id', profile.id)
      .gte('date', startStr)
      .lt('date', endStr)

    const rows = (transactions || []).map((row) => ({
      amount: Number(row.amount || 0),
      description: row.description as string | null,
      categoryName: (row.categories as { name?: string } | null)?.name || null,
    }))

    if (rows.length === 0) continue

    const message = buildWeeklyDigestMessage(rows)
    if (!message) continue

    await sendMessage(chatId, message)
    sent += 1
  }

  return NextResponse.json({
    ok: true,
    start: startStr,
    endExclusive: endStr,
    sent,
  })
}

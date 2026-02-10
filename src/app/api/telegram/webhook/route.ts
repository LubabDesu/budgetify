import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendMessage, parseTransactionWithLLM, answerCallbackQuery, applyTransactionEditsWithLLM, suggestOnboardingCategoriesWithLLM } from '@/lib/telegram'
import { sendBudgetNudgesForTransactions } from '@/lib/telegram-insights'

type PendingTransaction = {
  merchant?: string
  amount?: number
  category?: string
  date?: string
}

type SessionMeta = {
  category_options?: string[]
  onboarding_candidates?: string[]
}

type CompleteTransaction = {
  merchant: string
  amount: number
  category: string
  date: string
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_BOOTSTRAP_CATEGORIES = [
  'Groceries',
  'Dining',
  'Transport',
  'Rent',
  'Utilities',
  'Entertainment',
  'Shopping',
  'Health',
  'Education',
  'Travel',
]

function normalizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

async function upsertCategoryNamesForUser(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  categoryNames: string[],
) {
  const normalized = Array.from(
    new Set(
      categoryNames
        .map(normalizeCategoryName)
        .filter((name) => name.length > 0),
    ),
  )

  if (normalized.length === 0) return []

  const { data: existing } = await supabase
    .from('categories')
    .select('name')
    .eq('user_id', userId)

  const existingSet = new Set(
    (existing || []).map((row) => normalizeCategoryName(row.name).toLowerCase()),
  )

  const toInsert = normalized.filter((name) => !existingSet.has(name.toLowerCase()))
  if (toInsert.length > 0) {
    await supabase
      .from('categories')
      .insert(toInsert.map((name) => ({ user_id: userId, name, color: '#71717a' })))
  }

  return normalized
}

function getMissingFields(transaction: PendingTransaction) {
  const missing: Array<'merchant' | 'amount' | 'category' | 'date'> = []
  if (!transaction.merchant || transaction.merchant.trim().length === 0) missing.push('merchant')
  if (!Number.isFinite(transaction.amount) || Number(transaction.amount) <= 0) missing.push('amount')
  if (!transaction.category || transaction.category.trim().length === 0) missing.push('category')
  if (!transaction.date || !DATE_REGEX.test(transaction.date)) missing.push('date')
  return missing
}

function isCompleteTransaction(transaction: PendingTransaction): transaction is CompleteTransaction {
  return getMissingFields(transaction).length === 0
}

function fillDraftField(transaction: PendingTransaction, field: 'merchant' | 'amount' | 'category' | 'date', message: string) {
  const next = { ...transaction }

  if (field === 'merchant') {
    const value = extractMerchantName(message)
    if (!value) return null
    next.merchant = value
    return next
  }

  if (field === 'category') {
    const value = message.trim()
    if (!value) return null
    next.category = value
    return next
  }

  if (field === 'amount') {
    const amountMatch = message.match(/([0-9]+(?:\.[0-9]{1,2})?)/)
    if (!amountMatch) return null
    const amount = Number(amountMatch[1])
    if (!Number.isFinite(amount) || amount <= 0) return null
    next.amount = amount
    return next
  }

  const dateMatch = message.match(/\d{4}-\d{2}-\d{2}/)
  if (!dateMatch) return null
  next.date = dateMatch[0]
  return next
}

function clarificationPrompt(field: 'merchant' | 'amount' | 'category' | 'date', suggestedCategory?: string) {
  if (field === 'merchant') return 'Nice, just to clarify, what merchant was this at?'
  if (field === 'amount') return 'Got it. What was the exact amount?'
  if (field === 'category') {
    if (suggestedCategory?.trim()) {
      return `What category should I use for this transaction?\nSuggested: ${suggestedCategory}`
    }
    return 'What category should I use for this transaction?'
  }
  return 'What date was this transaction? Please use YYYY-MM-DD.'
}

function extractMerchantName(message: string) {
  const trimmed = message.trim()
  if (!trimmed) return ''

  const atMatch = trimmed.match(/\b(?:at|from)\s+(.+)$/i)
  if (atMatch?.[1]) {
    return atMatch[1].trim().replace(/^the\s+/i, '')
  }

  return trimmed
    .replace(/^i\s+(?:bought|purchased)\s+(?:it\s+)?(?:at|from)\s+/i, '')
    .replace(/^it\s+was\s+(?:at|from)\s+/i, '')
    .replace(/^merchant\s*[:\-]\s*/i, '')
    .trim()
}

function toDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildCategoryPrompt(
  sessionId: string,
  categories: string[],
  suggestedCategory?: string,
) {
  const normalized = Array.from(
    new Set(
      [suggestedCategory, ...categories]
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => value.trim()),
    ),
  ).slice(0, 6)

  const text = clarificationPrompt('category', suggestedCategory)
  if (normalized.length === 0) {
    return { text, keyboard: undefined, options: [] as string[] }
  }

  const rows = normalized.map((name, index) => [
    { text: name, callback_data: `pick_category:${sessionId}:${index}` },
  ])

  return {
    text: `${text}\nChoose one below or type your own.`,
    keyboard: { inline_keyboard: rows },
    options: normalized,
  }
}

function buildDatePrompt(sessionId: string) {
  return {
    text: 'What date was this transaction?',
    keyboard: {
      inline_keyboard: [
        [
          { text: 'Today', callback_data: `pick_date:${sessionId}:today` },
          { text: 'Yesterday', callback_data: `pick_date:${sessionId}:yesterday` },
        ],
        [{ text: 'Custom (YYYY-MM-DD)', callback_data: `pick_date:${sessionId}:custom` }],
      ],
    },
  }
}

function formatSummary(transactions: CompleteTransaction[]) {
  if (transactions.length === 1) {
    const transaction = transactions[0]
    return `
<b>Merchant:</b> ${transaction.merchant}
<b>Amount:</b> $${transaction.amount.toFixed(2)}
<b>Category:</b> ${transaction.category}
<b>Date:</b> ${transaction.date}

Does this look correct?
    `
  }

  const lines = transactions.map((transaction, index) =>
    `${index + 1}. ${transaction.merchant} - $${transaction.amount.toFixed(2)} - ${transaction.category} - ${transaction.date}`
  )

  return `<b>I found ${transactions.length} transactions:</b>\n${lines.join('\n')}\n\nLog all of these?`
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    console.log('📬 Telegram Webhook received:', JSON.stringify(payload, null, 2))
    const supabase = createAdminClient()

    // 1. Handle Messages
    if (payload.message) {
      const chatId = payload.message.chat.id
      const text = payload.message.text || ''
      const messageDate = payload.message.date
        ? toDateString(new Date(payload.message.date * 1000))
        : undefined

      // Command: /start <code>
      if (text.startsWith('/start')) {
        const parts = text.trim().split(/\s+/)
        if (parts.length > 1) {
          const code = parts[1]
          
          // Verify code
          const { data: linkingData, error: linkError } = await supabase
            .from('profile_linking_codes')
            .select('user_id, expires_at')
            .eq('code', code)
            .single()

          if (linkError || !linkingData || new Date(linkingData.expires_at) < new Date()) {
            await sendMessage(chatId, '❌ Invalid or expired linking code. Please generate a new one in the app.')
          } else {
            // Upsert guarantees a profile row exists before linking.
            const { data: linkedProfile, error: updateError } = await supabase
              .from('profiles')
              .upsert(
                {
                  id: linkingData.user_id,
                  telegram_chat_id: chatId,
                },
                { onConflict: 'id' }
              )
              .select('id, telegram_chat_id')
              .single()

            if (updateError || !linkedProfile || linkedProfile.telegram_chat_id !== chatId) {
              console.error('Telegram linking failed', {
                updateError,
                userId: linkingData.user_id,
                chatId,
                linkedProfile,
              })
              await sendMessage(chatId, '❌ Failed to link account. Please try again.')
            } else {
              // Delete code
              await supabase.from('profile_linking_codes').delete().eq('code', code)
              await sendMessage(chatId, '✅ Account successfully linked! You can now send me your transactions like "Spent 15.50 on lunch" or "Starbucks $5".')
              await supabase
                .from('telegram_sessions')
                .upsert({
                  chat_id: chatId,
                  user_id: linkingData.user_id,
                  state: 'onboarding_choice',
                  clarification_field: null,
                  pending_transactions: null,
                  session_meta: null,
                  updated_at: new Date().toISOString(),
                }, { onConflict: 'chat_id' })

              await sendMessage(
                chatId,
                'Want help setting up categories?',
                {
                  inline_keyboard: [
                    [{ text: '✨ Smart setup', callback_data: 'onboarding:smart' }],
                    [{ text: '📚 Use defaults', callback_data: 'onboarding:defaults' }],
                    [{ text: '⏭ Skip', callback_data: 'onboarding:skip' }],
                  ],
                },
              )
            }
          }
        } else {
          await sendMessage(chatId, 'Welcome to the Budget Tracker Bot! 💸\n\nPlease link your account by sending /start followed by your linking code from the app.')
        }
        return NextResponse.json({ ok: true })
      }

      // Handle raw transaction logging
      // Check if user is linked
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('telegram_chat_id', chatId)
        .single()

      if (!profile) {
        await sendMessage(chatId, '⚠️ Your account is not linked. Please use /link in the app to get your connection code.')
        return NextResponse.json({ ok: true })
      }

      const { data: currentSession } = await supabase
        .from('telegram_sessions')
        .select('id, state, clarification_field, pending_transactions, session_meta')
        .eq('chat_id', chatId)
        .eq('user_id', profile.id)
        .maybeSingle()

      const { data: categories } = await supabase
        .from('categories')
        .select('name')
        .eq('user_id', profile.id)
      
      const categoryNames = (categories || []).map(c => c.name)

      if (currentSession?.state === 'onboarding_choice') {
        await sendMessage(
          chatId,
          'I can suggest categories. Choose Smart setup, Use defaults, or Skip from the buttons above.',
        )
        return NextResponse.json({ ok: true })
      }

      if (currentSession?.state === 'onboarding_profile') {
        if (text.trim().toLowerCase() === 'skip') {
          await supabase
            .from('telegram_sessions')
            .update({
              state: 'idle',
              clarification_field: null,
              pending_transactions: null,
              session_meta: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentSession.id)
          await sendMessage(chatId, 'Skipped category bootstrap. You can start logging transactions now.')
          return NextResponse.json({ ok: true })
        }

        try {
          const suggested = await suggestOnboardingCategoriesWithLLM(text)
          const categoriesToApply = suggested.length > 0 ? suggested : DEFAULT_BOOTSTRAP_CATEGORIES
          const applied = await upsertCategoryNamesForUser(supabase, profile.id, categoriesToApply)

          await supabase
            .from('telegram_sessions')
            .update({
              state: 'idle',
              clarification_field: null,
              pending_transactions: null,
              session_meta: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentSession.id)

          const preview = applied.slice(0, 8).join(', ')
          await sendMessage(
            chatId,
            `✅ Category setup complete. Added ${applied.length} categories.\n${preview}${applied.length > 8 ? ', ...' : ''}`,
          )
        } catch (error) {
          if (error instanceof Error && error.message === 'LLM_TIMEOUT') {
            await sendMessage(chatId, '⏱️ Setup timed out. Try again with a shorter profile, or type "skip".')
          } else {
            await sendMessage(chatId, '❌ Could not generate categories. Type "skip" to continue without bootstrap.')
          }
        }
        return NextResponse.json({ ok: true })
      }

      if (currentSession?.state === 'awaiting_clarification') {
        const pendingList = Array.isArray(currentSession.pending_transactions)
          ? currentSession.pending_transactions as PendingTransaction[]
          : []
        const active = pendingList[0] || {}
        const field = (currentSession.clarification_field || 'merchant') as 'merchant' | 'amount' | 'category' | 'date'
        const updated = fillDraftField(active, field, text)

        if (!updated) {
          await sendMessage(chatId, `⚠️ I still need your ${field}. ${clarificationPrompt(field)}`)
          return NextResponse.json({ ok: true })
        }

        const missing = getMissingFields(updated)
        if (missing.length > 0) {
          await supabase
            .from('telegram_sessions')
            .update({
              state: 'awaiting_clarification',
              clarification_field: missing[0],
              pending_transactions: [updated],
              session_meta: currentSession.session_meta,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentSession.id)

          if (missing[0] === 'category') {
            const prompt = buildCategoryPrompt(currentSession.id, categoryNames)
            await supabase
              .from('telegram_sessions')
              .update({
                session_meta: { category_options: prompt.options },
                updated_at: new Date().toISOString(),
              })
              .eq('id', currentSession.id)
            await sendMessage(chatId, prompt.text, prompt.keyboard)
            return NextResponse.json({ ok: true })
          }

          if (missing[0] === 'date') {
            const prompt = buildDatePrompt(currentSession.id)
            await sendMessage(chatId, prompt.text, prompt.keyboard)
            return NextResponse.json({ ok: true })
          }

          await sendMessage(chatId, clarificationPrompt(missing[0]))
          return NextResponse.json({ ok: true })
        }

        await supabase
          .from('telegram_sessions')
          .update({
            state: 'awaiting_confirmation',
            clarification_field: null,
            pending_transactions: [updated],
            session_meta: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentSession.id)

        const summary = formatSummary([updated as CompleteTransaction])
        const keyboard = {
          inline_keyboard: [[
            { text: '✅ Log It', callback_data: `log_session:${currentSession.id}` },
            { text: '❌ Cancel', callback_data: `cancel_session:${currentSession.id}` }
          ]]
        }
        await sendMessage(chatId, summary, keyboard)
        return NextResponse.json({ ok: true })
      }

      if (currentSession?.state === 'awaiting_confirmation' && !text.startsWith('/')) {
        const pendingList = Array.isArray(currentSession.pending_transactions)
          ? currentSession.pending_transactions as PendingTransaction[]
          : []
        const currentTransactions = pendingList.filter(isCompleteTransaction)

        if (currentTransactions.length > 0) {
          await sendMessage(chatId, '✏️ Updating draft...')

          try {
            const editResult = await applyTransactionEditsWithLLM(
              text,
              currentTransactions,
              categoryNames,
              messageDate,
            )

            if (editResult.kind === 'updated') {
              const summary = formatSummary(editResult.transactions)
              await supabase
                .from('telegram_sessions')
                .update({
                  pending_transactions: editResult.transactions,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', currentSession.id)

              const keyboard = {
                inline_keyboard: [[
                  { text: editResult.transactions.length > 1 ? '✅ Log All' : '✅ Log It', callback_data: `log_session:${currentSession.id}` },
                  { text: '❌ Cancel', callback_data: `cancel_session:${currentSession.id}` }
                ]]
              }
              await sendMessage(chatId, summary, keyboard)
              return NextResponse.json({ ok: true })
            }

            await sendMessage(chatId, `⚠️ ${editResult.reason}`)
            return NextResponse.json({ ok: true })
          } catch (error) {
            if (error instanceof Error && error.message === 'LLM_TIMEOUT') {
              await sendMessage(chatId, '⏱️ Edit timed out. Try a shorter instruction like "set all dates to 2026-02-07".')
            } else {
              await sendMessage(chatId, '❌ Could not apply that edit. Please try again.')
            }
            return NextResponse.json({ ok: true })
          }
        }
      }

      // User confirmed - Parse with LLM
      await sendMessage(chatId, '🔄 Parsing your transaction...')
      
      try {
        const parseResult = await parseTransactionWithLLM(text, categoryNames, messageDate)

        if (parseResult.kind === 'reject') {
          await sendMessage(chatId, `⚠️ ${parseResult.reason}`)
          return NextResponse.json({ ok: true })
        }

        if (parseResult.kind === 'clarify') {
          const missing = parseResult.missingFields.length > 0
            ? parseResult.missingFields
            : getMissingFields(parseResult.draft)

          if (missing.length === 0 && isCompleteTransaction(parseResult.draft)) {
            const summary = formatSummary([parseResult.draft])
            const { data: session } = await supabase
              .from('telegram_sessions')
              .upsert({
                chat_id: chatId,
                user_id: profile.id,
                state: 'awaiting_confirmation',
                clarification_field: null,
                pending_transactions: [parseResult.draft],
                session_meta: null,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'chat_id' })
              .select('id')
              .single()

            if (session?.id) {
              const keyboard = {
                inline_keyboard: [[
                  { text: '✅ Log It', callback_data: `log_session:${session.id}` },
                  { text: '❌ Cancel', callback_data: `cancel_session:${session.id}` }
                ]]
              }
              await sendMessage(chatId, summary, keyboard)
            }
            return NextResponse.json({ ok: true })
          }

          const field = missing[0] || 'merchant'
          const { data: session } = await supabase
            .from('telegram_sessions')
            .upsert({
              chat_id: chatId,
              user_id: profile.id,
              state: 'awaiting_clarification',
              clarification_field: field,
              pending_transactions: [parseResult.draft],
              session_meta: null,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'chat_id' })
            .select('id')
            .single()

          if (field === 'category' && session?.id) {
            const prompt = buildCategoryPrompt(session.id, categoryNames, parseResult.suggestedCategory)
            await supabase
              .from('telegram_sessions')
              .update({
                session_meta: { category_options: prompt.options },
                updated_at: new Date().toISOString(),
              })
              .eq('id', session.id)
            await sendMessage(chatId, prompt.text, prompt.keyboard)
            return NextResponse.json({ ok: true })
          }

          if (field === 'date' && session?.id) {
            const prompt = buildDatePrompt(session.id)
            await sendMessage(chatId, prompt.text, prompt.keyboard)
            return NextResponse.json({ ok: true })
          }

          await sendMessage(chatId, parseResult.question || clarificationPrompt(field, parseResult.suggestedCategory))
          return NextResponse.json({ ok: true })
        }

        const transactions = parseResult.kind === 'single'
          ? [parseResult.transaction]
          : parseResult.transactions
        const summary = formatSummary(transactions)
        const { data: session } = await supabase
          .from('telegram_sessions')
          .upsert({
            chat_id: chatId,
            user_id: profile.id,
            state: 'awaiting_confirmation',
            clarification_field: null,
            pending_transactions: transactions,
            session_meta: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'chat_id' })
          .select('id')
          .single()

        if (!session?.id) {
          await sendMessage(chatId, '❌ Failed to create confirmation session. Please try again.')
          return NextResponse.json({ ok: true })
        }

        const keyboard = {
          inline_keyboard: [[
            { text: transactions.length > 1 ? '✅ Log All' : '✅ Log It', callback_data: `log_session:${session.id}` },
            { text: '❌ Cancel', callback_data: `cancel_session:${session.id}` }
          ]]
        }
        await sendMessage(chatId, summary, keyboard)
      } catch (error) {
        if (error instanceof Error && error.message === 'LLM_TIMEOUT') {
          await sendMessage(chatId, '⏱️ Parsing timed out. Please try a shorter message like "Spent 12.50 on lunch".')
        } else {
          await sendMessage(chatId, "❌ Sorry, I couldn't parse that transaction. Try being more specific, e.g., 'Spent $10 at Subway'.")
        }
      }
    }

    // 2. Handle Callbacks
    if (payload.callback_query) {
      const callbackQuery = payload.callback_query
      const chatId = callbackQuery.message.chat.id
      const data = callbackQuery.data

      if (data.startsWith('onboarding:')) {
        const mode = data.replace('onboarding:', '')
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('telegram_chat_id', chatId)
          .single()

        if (!profile) {
          await answerCallbackQuery(callbackQuery.id, 'Not linked')
          return NextResponse.json({ ok: true })
        }

        if (mode === 'skip') {
          await supabase
            .from('telegram_sessions')
            .upsert({
              chat_id: chatId,
              user_id: profile.id,
              state: 'idle',
              clarification_field: null,
              pending_transactions: null,
              session_meta: null,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'chat_id' })
          await answerCallbackQuery(callbackQuery.id, 'Skipped')
          await sendMessage(chatId, 'No problem. You can start logging transactions now.')
          return NextResponse.json({ ok: true })
        }

        if (mode === 'defaults') {
          const applied = await upsertCategoryNamesForUser(
            supabase,
            profile.id,
            DEFAULT_BOOTSTRAP_CATEGORIES,
          )
          await supabase
            .from('telegram_sessions')
            .upsert({
              chat_id: chatId,
              user_id: profile.id,
              state: 'idle',
              clarification_field: null,
              pending_transactions: null,
              session_meta: null,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'chat_id' })
          await answerCallbackQuery(callbackQuery.id, 'Applied defaults')
          await sendMessage(chatId, `✅ Added ${applied.length} default categories. Start logging whenever you’re ready.`)
          return NextResponse.json({ ok: true })
        }

        await supabase
          .from('telegram_sessions')
          .upsert({
            chat_id: chatId,
            user_id: profile.id,
            state: 'onboarding_profile',
            clarification_field: null,
            pending_transactions: null,
            session_meta: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'chat_id' })
        await answerCallbackQuery(callbackQuery.id, 'Smart setup')
        await sendMessage(
          chatId,
          'Tell me what you usually spend on (work/school, commute, food, subscriptions, hobbies), and I’ll generate starter categories.',
        )
        return NextResponse.json({ ok: true })
      } else if (data === 'cancel') {
        await answerCallbackQuery(callbackQuery.id, 'Cancelled')
        await sendMessage(chatId, '🚫 Transaction cancelled.')
      } else if (data.startsWith('cancel_session:')) {
        const sessionId = data.replace('cancel_session:', '')
        await supabase
          .from('telegram_sessions')
          .update({
            state: 'idle',
            clarification_field: null,
            pending_transactions: null,
            session_meta: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .eq('chat_id', chatId)
        await answerCallbackQuery(callbackQuery.id, 'Cancelled')
        await sendMessage(chatId, '🚫 Transaction cancelled.')
      } else if (data.startsWith('pick_category:')) {
        const [, sessionId, rawIndex] = data.split(':')
        const index = Number(rawIndex)
        const { data: session } = await supabase
          .from('telegram_sessions')
          .select('id, state, clarification_field, pending_transactions, session_meta')
          .eq('id', sessionId)
          .eq('chat_id', chatId)
          .single()

        const options = (session?.session_meta as SessionMeta | null)?.category_options || []
        const picked = options[index]
        if (!session || !picked) {
          await answerCallbackQuery(callbackQuery.id, 'Option expired')
          await sendMessage(chatId, '❌ Category options expired. Please type the category.')
          return NextResponse.json({ ok: true })
        }

        const pendingList = Array.isArray(session.pending_transactions)
          ? session.pending_transactions as PendingTransaction[]
          : []
        const active = pendingList[0] || {}
        const updated = { ...active, category: picked }
        const missing = getMissingFields(updated)

        await answerCallbackQuery(callbackQuery.id, `Selected ${picked}`)

        if (missing.length > 0) {
          await supabase
            .from('telegram_sessions')
            .update({
              state: 'awaiting_clarification',
              clarification_field: missing[0],
              pending_transactions: [updated],
              session_meta: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', session.id)

          if (missing[0] === 'date') {
            const prompt = buildDatePrompt(session.id)
            await sendMessage(chatId, prompt.text, prompt.keyboard)
            return NextResponse.json({ ok: true })
          }

          await sendMessage(chatId, clarificationPrompt(missing[0]))
          return NextResponse.json({ ok: true })
        }

        await supabase
          .from('telegram_sessions')
          .update({
            state: 'awaiting_confirmation',
            clarification_field: null,
            pending_transactions: [updated],
            session_meta: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id)

        const summary = formatSummary([updated as CompleteTransaction])
        const keyboard = {
          inline_keyboard: [[
            { text: '✅ Log It', callback_data: `log_session:${session.id}` },
            { text: '❌ Cancel', callback_data: `cancel_session:${session.id}` }
          ]]
        }
        await sendMessage(chatId, summary, keyboard)
      } else if (data.startsWith('pick_date:')) {
        const [, sessionId, mode] = data.split(':')
        const { data: session } = await supabase
          .from('telegram_sessions')
          .select('id, pending_transactions')
          .eq('id', sessionId)
          .eq('chat_id', chatId)
          .single()

        if (!session) {
          await answerCallbackQuery(callbackQuery.id, 'Session expired')
          await sendMessage(chatId, '❌ Session expired. Please send the transaction again.')
          return NextResponse.json({ ok: true })
        }

        const pendingList = Array.isArray(session.pending_transactions)
          ? session.pending_transactions as PendingTransaction[]
          : []
        const active = pendingList[0] || {}

        if (mode === 'custom') {
          await answerCallbackQuery(callbackQuery.id, 'Send custom date')
          await supabase
            .from('telegram_sessions')
            .update({
              state: 'awaiting_clarification',
              clarification_field: 'date',
              pending_transactions: [active],
              updated_at: new Date().toISOString(),
            })
            .eq('id', session.id)
          await sendMessage(chatId, 'Please type the date as YYYY-MM-DD.')
          return NextResponse.json({ ok: true })
        }

        const now = new Date()
        const date = mode === 'yesterday'
          ? toDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
          : toDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate()))

        const updated = { ...active, date }
        const missing = getMissingFields(updated)
        await answerCallbackQuery(callbackQuery.id, `Date set to ${date}`)

        if (missing.length > 0) {
          await supabase
            .from('telegram_sessions')
            .update({
              state: 'awaiting_clarification',
              clarification_field: missing[0],
              pending_transactions: [updated],
              session_meta: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', session.id)

          if (missing[0] === 'category') {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('telegram_chat_id', chatId)
              .single()
            if (!profile) {
              await sendMessage(chatId, '⚠️ Your account is not linked. Please use /link in the app to get your connection code.')
              return NextResponse.json({ ok: true })
            }
            const { data: categories } = await supabase
              .from('categories')
              .select('name')
              .eq('user_id', profile.id)
            const categoryNames = (categories || []).map(c => c.name)
            const prompt = buildCategoryPrompt(session.id, categoryNames)
            await supabase
              .from('telegram_sessions')
              .update({
                session_meta: { category_options: prompt.options },
                updated_at: new Date().toISOString(),
              })
              .eq('id', session.id)
            await sendMessage(chatId, prompt.text, prompt.keyboard)
            return NextResponse.json({ ok: true })
          }

          await sendMessage(chatId, clarificationPrompt(missing[0]))
          return NextResponse.json({ ok: true })
        }

        await supabase
          .from('telegram_sessions')
          .update({
            state: 'awaiting_confirmation',
            clarification_field: null,
            pending_transactions: [updated],
            session_meta: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id)

        const summary = formatSummary([updated as CompleteTransaction])
        const keyboard = {
          inline_keyboard: [[
            { text: '✅ Log It', callback_data: `log_session:${session.id}` },
            { text: '❌ Cancel', callback_data: `cancel_session:${session.id}` }
          ]]
        }
        await sendMessage(chatId, summary, keyboard)
      } else if (data.startsWith('log_session:')) {
        const sessionId = data.replace('log_session:', '')
        const { data: session } = await supabase
          .from('telegram_sessions')
          .select('id, user_id, pending_transactions')
          .eq('id', sessionId)
          .eq('chat_id', chatId)
          .single()

        if (!session) {
          await answerCallbackQuery(callbackQuery.id, 'Session expired')
          await sendMessage(chatId, '❌ Session expired. Please send the transaction again.')
          return NextResponse.json({ ok: true })
        }

        const pendingList = Array.isArray(session.pending_transactions)
          ? session.pending_transactions as PendingTransaction[]
          : []
        const transactions = pendingList.filter(isCompleteTransaction)

        if (transactions.length === 0) {
          await answerCallbackQuery(callbackQuery.id, 'No valid transactions')
          await sendMessage(chatId, '❌ No valid transactions found in this confirmation. Please send them again.')
          return NextResponse.json({ ok: true })
        }

        const categoryCache = new Map<string, string | null>()
        const records = []

        for (const transaction of transactions) {
          let categoryId = categoryCache.get(transaction.category) ?? null
          if (!categoryCache.has(transaction.category)) {
            const { data: existingCategory } = await supabase
              .from('categories')
              .select('id')
              .eq('user_id', session.user_id)
              .eq('name', transaction.category)
              .maybeSingle()

            if (existingCategory?.id) {
              categoryId = existingCategory.id
            } else {
              const { data: newCategory } = await supabase
                .from('categories')
                .insert({ user_id: session.user_id, name: transaction.category, color: '#71717a' })
                .select('id')
                .single()
              categoryId = newCategory?.id ?? null
            }
            categoryCache.set(transaction.category, categoryId)
          }

          records.push({
            user_id: session.user_id,
            amount: transaction.amount,
            description: transaction.merchant,
            category_id: categoryId,
            date: transaction.date,
          })
        }

        const { error } = await supabase
          .from('transactions')
          .insert(records)

        if (error) {
          await sendMessage(chatId, '❌ Failed to log transaction. Please try again.')
        } else {
          await sendBudgetNudgesForTransactions(
            supabase,
            session.user_id,
            chatId,
            records.map((record) => ({
              category_id: record.category_id,
              date: record.date,
            })),
          )

          await supabase
            .from('telegram_sessions')
            .update({
            state: 'idle',
            clarification_field: null,
            pending_transactions: null,
            session_meta: null,
            updated_at: new Date().toISOString(),
          })
            .eq('id', sessionId)
            .eq('chat_id', chatId)

          await answerCallbackQuery(callbackQuery.id, 'Logged!')
          await sendMessage(chatId, `✅ Successfully logged <b>${transactions.length}</b> transaction${transactions.length > 1 ? 's' : ''}.`)
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

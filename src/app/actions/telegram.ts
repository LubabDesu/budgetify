'use server'

import { createClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export async function generateLinkingCode() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Generate a 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

  const { error } = await supabase
    .from('profile_linking_codes')
    .insert({
      user_id: user.id,
      code,
      expires_at: expiresAt
    })

  if (error) throw error

  return code
}

export async function getTelegramConnectionStatus() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { connected: false }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('telegram_chat_id')
    .eq('id', user.id)
    .single()

  if (error || !profile) return { connected: false }

  return {
    connected: !!profile.telegram_chat_id,
    chatId: profile.telegram_chat_id
  }
}

export async function disconnectTelegram() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('profiles')
    .update({ telegram_chat_id: null })
    .eq('id', user.id)

  if (error) throw error
  
  revalidatePath('/')
  return { success: true }
}

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Send, CheckCircle2, XCircle, Copy, RefreshCw } from 'lucide-react'
import { generateLinkingCode, getTelegramConnectionStatus, disconnectTelegram } from '@/app/actions/telegram'
import { toast } from 'sonner'

export function TelegramSettings() {
  const [status, setStatus] = useState<{ connected: boolean; chatId?: number } | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    const res = await getTelegramConnectionStatus()
    setStatus(res)
  }

  const handleGenerateCode = async () => {
    setLoading(true)
    try {
      const newCode = await generateLinkingCode()
      setCode(newCode)
      toast.success('Linking code generated!')
    } catch (error) {
      toast.error('Failed to generate code')
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Telegram?')) return
    setLoading(true)
    try {
      await disconnectTelegram()
      setStatus({ connected: false })
      setCode(null)
      toast.success('Telegram disconnected')
    } catch (error) {
      toast.error('Failed to disconnect')
    } finally {
      setLoading(false)
    }
  }

  const copyCode = () => {
    if (code) {
      navigator.clipboard.writeText(`/start ${code}`)
      toast.success('Command copied to clipboard!')
    }
  }

  return (
    <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Send className="w-4 h-4 text-blue-400" />
            </div>
            <CardTitle>Telegram Integration</CardTitle>
          </div>
          {status?.connected ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full border border-emerald-400/20">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 bg-zinc-500/10 px-2 py-1 rounded-full border border-zinc-500/20">
              <XCircle className="w-3 h-3" /> Not Linked
            </div>
          )}
        </div>
        <CardDescription>
          Log transactions directly via Telegram using natural language.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {status?.connected ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 text-sm text-zinc-400">
              Your account is successfully linked to Telegram (Chat ID: {status.chatId}). 
              Simply message the bot to log your spending!
            </div>
            <Button 
              variant="outline" 
              className="w-full border-zinc-800 text-rose-400 hover:text-rose-300 hover:bg-rose-400/5 hover:border-rose-400/20"
              onClick={handleDisconnect}
              disabled={loading}
            >
              Disconnect Telegram
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {!code ? (
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-500 font-bold gap-2"
                onClick={handleGenerateCode}
                disabled={loading}
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Connect Telegram Bot
              </Button>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="text-center space-y-2">
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Step 1: Search for our bot</p>
                  <p className="text-sm font-bold text-white">@budgetifyLubab_bot</p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 space-y-3">
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider text-center">Step 2: Send this command</p>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-emerald-400 text-sm overflow-hidden whitespace-nowrap">
                    <span className="flex-grow shrink overflow-ellipsis">/start {code}</span>
                    <button onClick={copyCode} className="shrink-0 hover:text-white transition-colors">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-600 text-center italic">Code expires in 10 minutes</p>
                </div>
                <Button 
                  variant="ghost" 
                  className="w-full text-zinc-500 hover:text-zinc-300"
                  onClick={handleGenerateCode}
                  disabled={loading}
                >
                  Regenerate Code
                </Button>
              </div>
            )}
            
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">How it works</h4>
              <ul className="space-y-2">
                <li className="text-xs text-zinc-500 flex gap-2">
                  <div className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 text-[10px]">1</div>
                  <span>Send phrases like "Coffee 4.50" or "$20 gas station"</span>
                </li>
                <li className="text-xs text-zinc-500 flex gap-2">
                  <div className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 text-[10px]">2</div>
                  <span>Our AI will extract the merchant, amount, and category</span>
                </li>
                <li className="text-xs text-zinc-500 flex gap-2">
                  <div className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 text-[10px]">3</div>
                  <span>Confirm the details with a single tap in Telegram</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

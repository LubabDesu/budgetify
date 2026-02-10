'use client'

import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet } from 'lucide-react'

export default function LoginPage() {
  const supabase = createClient()

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4 font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[25%] -left-[10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[25%] -right-[10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>
      
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/50 backdrop-blur-xl shadow-2xl relative z-10">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-emerald-500/10 p-3 rounded-2xl w-fit mb-2 border border-emerald-500/20">
            <Wallet className="w-8 h-8 text-emerald-400" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-white">Budget Tracker</CardTitle>
          <CardDescription className="text-zinc-400 text-base">
            Smart spending tracking with AI receipt parsing
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <Button 
            onClick={handleLogin}
            variant="outline"
            className="w-full h-12 bg-white text-black hover:bg-zinc-200 border-none font-semibold text-base transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
              <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
            </svg>
            Sign in with Google
          </Button>
          <p className="mt-6 text-center text-xs text-zinc-500 leading-relaxed uppercase tracking-widest font-medium">
            Automated • Intelligent • Secure
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

import { TelegramSettings } from '@/components/TelegramSettings'

export default function SettingsPage() {
  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white font-geist-sans">Settings</h1>
        <p className="text-zinc-500 mt-1">Manage your account preferences and integrations.</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <TelegramSettings />
        
        <div className="p-6 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/10 text-center">
          <p className="text-sm text-zinc-600 italic">More settings coming soon...</p>
        </div>
      </div>
    </div>
  )
}

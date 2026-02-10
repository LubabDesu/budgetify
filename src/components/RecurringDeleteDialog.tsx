'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Trash2 } from 'lucide-react'

interface RecurringDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (mode: 'all' | 'future' | 'this') => void
  description: string
  hasFutureOccurrences?: boolean
}

export function RecurringDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  description,
  hasFutureOccurrences = true,
}: RecurringDeleteDialogProps) {
  const [mode, setMode] = useState<'all' | 'future' | 'this'>('all')

  const handleConfirm = () => {
    onConfirm(mode)
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-md">
        <AlertDialogHeader>
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <AlertDialogTitle className="text-xl">Delete Recurring Payment?</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            How would you like to delete <span className="text-white font-medium">{description}</span>?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <RadioGroup 
            value={mode} 
            onValueChange={(val: 'all' | 'future' | 'this') => setMode(val)}
            className="space-y-3"
          >
            <div className="flex items-center space-x-3 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors">
              <RadioGroupItem value="this" id="mode-this" className="text-red-500 border-zinc-700" />
              <Label htmlFor="mode-this" className="flex-1 cursor-pointer">
                <div className="font-medium">This occurrence only</div>
                <div className="text-xs text-zinc-500">Delete only the scheduled payment for this date.</div>
              </Label>
            </div>
            
            {hasFutureOccurrences && (
              <div className="flex items-center space-x-3 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors">
                <RadioGroupItem value="future" id="mode-future" className="text-red-500 border-zinc-700" />
                <Label htmlFor="mode-future" className="flex-1 cursor-pointer">
                  <div className="font-medium">This and all future occurrences</div>
                  <div className="text-xs text-zinc-500">The subscription will end immediately after today.</div>
                </Label>
              </div>
            )}

            <div className="flex items-center space-x-3 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors">
              <RadioGroupItem value="all" id="mode-all" className="text-red-500 border-zinc-700" />
              <Label htmlFor="mode-all" className="flex-1 cursor-pointer">
                <div className="font-medium">All occurrences (Delete entire series)</div>
                <div className="text-xs text-zinc-500">Completely remove this recurring payment from your list.</div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel className="bg-transparent border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white border-zinc-700">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            className="bg-red-600 hover:bg-red-500 text-white border-none font-bold"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

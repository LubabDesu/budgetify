'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createTransactionWithItems } from '@/app/actions/transactions'
import { Category } from '@/types/database'

interface ReceiptCardProps {
  scan: {
    data: {
      merchant: string
      total_amount: number
      date: string
      main_category: string
      items: {
        description: string
        amount: number
        category: string
      }[]
    }
  }
  categories: Category[]
  onSuccess: () => void
}

export function ReceiptCard({ scan, categories, onSuccess }: ReceiptCardProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [data, setData] = useState(scan.data)

  // Auto-calculate total when items change
  useEffect(() => {
    const total = data.items.reduce((sum, item) => sum + (item.amount || 0), 0)
    
    if (total !== data.total_amount) {
      setData(prev => ({ ...prev, total_amount: total }))
    }
  }, [data.items])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const matchedCategory = categories.find(c => 
        c.name.toLowerCase() === data.main_category?.toLowerCase()
      )

      await createTransactionWithItems(
        {
          amount: data.total_amount,
          description: data.merchant,
          date: data.date,
          category_id: matchedCategory?.id,
        },
        data.items.map((item: any) => {
          const itemCat = categories.find(c => c.name.toLowerCase() === item.category?.toLowerCase())
          return {
            description: item.description,
            amount: item.amount,
            category_id: itemCat?.id
          }
        })
      )

      toast.success('Transaction saved!')
      onSuccess()
      router.refresh()
    } catch (error) {
      console.error('Save failed:', error)
      toast.error('Failed to save transaction')
    } finally {
      setIsSaving(false)
    }
  }

  const updateItem = (index: number, key: string, value: any) => {
    const newItems = [...data.items]
    newItems[index] = { ...newItems[index], [key]: value }
    setData({ ...data, items: newItems })
  }

  const removeItem = (index: number) => {
    const newItems = data.items.filter((_, i) => i !== index)
    setData({ ...data, items: newItems })
  }

  return (
    <Card className="bg-zinc-900/40 border-zinc-800 overflow-hidden">
      <div className="p-4 bg-zinc-900/60 border-b border-zinc-800 flex justify-between items-center">
        <div className="flex-1 min-w-0 mr-4">
          <Input 
            value={data.merchant} 
            onChange={(e) => setData({ ...data, merchant: e.target.value })}
            className="bg-transparent border-none text-lg font-bold p-0 h-auto focus-visible:ring-0 text-white w-full"
            placeholder="Merchant Name"
          />
          <Input 
            type="date"
            value={data.date} 
            onChange={(e) => setData({ ...data, date: e.target.value })}
            className="bg-transparent border-none text-xs text-zinc-500 p-0 h-auto focus-visible:ring-0 mt-1"
          />
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-1 flex items-center justify-end">
            <span className="mr-1">●</span> Auto-Total
          </div>
          <Input 
            type="number"
            readOnly
            value={data.total_amount.toFixed(2)} 
            className="bg-transparent border-none text-xl font-bold p-0 h-auto focus-visible:ring-0 text-emerald-400 text-right w-24 cursor-default"
          />
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Line Items</p>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Amount</p>
        </div>
        
        <div className="space-y-2">
          {data.items.map((item: any, idx: number) => (
            <div key={idx} className="flex gap-3 items-center group">
              <div className="flex-1">
                <Input 
                  value={item.description} 
                  onChange={(e) => updateItem(idx, 'description', e.target.value)}
                  className="bg-transparent border-none text-sm p-0 h-auto focus-visible:ring-0 text-zinc-200"
                  placeholder="Item description"
                />
              </div>
              <div className="w-20">
                <Input 
                  type="number"
                  value={item.amount} 
                  onChange={(e) => updateItem(idx, 'amount', parseFloat(e.target.value) || 0)}
                  className="bg-transparent border-none text-sm text-right p-0 h-auto focus-visible:ring-0 text-zinc-300 font-mono"
                  placeholder="0.00"
                />
              </div>
              <button 
                onClick={() => removeItem(idx)}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-opacity p-1"
                title="Remove item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          className="w-full mt-2 border-dashed border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/20"
          onClick={() => setData({ 
            ...data, 
            items: [...data.items, { description: '', amount: 0, category: 'General' }] 
          })}
        >
          <Plus className="w-3 w-3 mr-2" /> Add Item
        </Button>

        <div className="pt-4 mt-2 border-t border-zinc-800/50">
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Confirm & Save Transaction'
            )}
          </Button>
        </div>
      </div>
    </Card>
  )
}

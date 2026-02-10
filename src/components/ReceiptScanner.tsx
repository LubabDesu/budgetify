'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, Loader2, CheckCircle2, Receipt, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { scanReceipt } from '@/app/actions/scan-receipt'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { ReceiptCard } from './ReceiptCard'

interface ScannedReceipt {
  id: string
  file: File
  preview: string
  status: 'scanning' | 'completed' | 'error'
  data?: any // This will be the header + items
}

export function ReceiptScanner({ children, categories }: { children: React.ReactNode, categories: any[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [pendingScans, setPendingScans] = useState<ScannedReceipt[]>([])

  // Helper to resize image
  const resizeImage = async (file: File): Promise<string> => {
    // ... (logic remains same as existing resizeImage)
    const isHeic = file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic'
    let imageSource: Blob | File = file

    if (isHeic) {
      const heic2any = (await import('heic2any')).default
      const converted = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.8
      })
      imageSource = Array.isArray(converted) ? converted[0] : converted
    }

    const bitmap = await createImageBitmap(imageSource)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context not available')

    let width = bitmap.width
    let height = bitmap.height
    const maxSize = 1024
    
    if (width > height) {
      if (width > maxSize) { height *= maxSize / width; width = maxSize; }
    } else {
      if (height > maxSize) { width *= maxSize / height; height = maxSize; }
    }

    canvas.width = width
    canvas.height = height
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', 0.7)
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Add new files to the list immediately with 'scanning' status
    const newScans: ScannedReceipt[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file),
      status: 'scanning'
    }))

    setPendingScans(prev => [...prev, ...newScans])

    // Process each file
    for (const scan of newScans) {
      try {
        const base64 = await resizeImage(scan.file)
        const categoryNames = categories.map(c => c.name)
        const result = await scanReceipt(base64, categoryNames)
          
        setPendingScans(prev => prev.map(s => 
          s.id === scan.id 
            ? { ...s, status: result.success ? 'completed' : 'error', data: result.data } 
            : s
        ))

        if (result.success) {
          toast.success(`Scanned ${scan.file.name}`)
        } else {
          toast.error(`Failed to read ${scan.file.name}`)
        }
      } catch (error) {
        console.error('Scan failed:', error)
        setPendingScans(prev => prev.map(s => 
          s.id === scan.id ? { ...s, status: 'error' } : s
        ))
        toast.error(`Error processing ${scan.file.name}`)
      }
    }
  }, [categories])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'image/jpeg': [],
      'image/png': [],
      'image/webp': [],
      'image/heic': ['.heic'] 
    },
    multiple: true,
    onDropRejected: (fileRejections) => {
      fileRejections.forEach((rejection) => {
        toast.error(`Error: ${rejection.errors[0].message || 'Invalid file'}`)
      })
    }
  })

  const removeScan = (id: string) => {
    setPendingScans(prev => {
      const scan = prev.find(s => s.id === id)
      if (scan) URL.revokeObjectURL(scan.preview)
      return prev.filter(s => s.id !== id)
    })
  }

  const reset = () => {
    pendingScans.forEach(s => URL.revokeObjectURL(s.preview))
    setPendingScans([])
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) reset()
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[1100px] bg-zinc-950 border-zinc-900 text-white overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Advanced Receipt Scanner</DialogTitle>
        </DialogHeader>
        
        <div className="grid md:grid-cols-[350px_1fr] gap-6 flex-1 overflow-hidden p-1">
          {/* Left Side: Upload Zone & Queue */}
          <div className="flex flex-col gap-4 overflow-hidden">
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all flex flex-col items-center justify-center text-center shrink-0
                ${isDragActive ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'}
              `}
            >
              <input {...getInputProps()} />
              <Upload className="w-6 h-6 text-zinc-400 mb-2" />
              <p className="text-sm font-medium text-zinc-300">Add more receipts</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {pendingScans.map((scan) => (
                <div 
                  key={scan.id} 
                  className={`relative p-3 rounded-lg border flex gap-3 transition-colors ${
                    scan.status === 'error' ? 'border-red-500/50 bg-red-500/5' : 'border-zinc-800 bg-zinc-900/30'
                  }`}
                >
                  <div className="relative w-16 h-16 rounded overflow-hidden flex-shrink-0 bg-black">
                    <Image src={scan.preview} alt="Preview" fill className="object-cover opacity-60" unoptimized />
                    {scan.status === 'scanning' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-300 truncate">{scan.file.name}</p>
                    <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider">
                      {scan.status === 'scanning' ? 'Analyzing...' : scan.status === 'completed' ? 'Extraction Done' : 'Failed'}
                    </p>
                  </div>

                  <button 
                    onClick={() => removeScan(scan.id)}
                    className="p-1 hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {pendingScans.length === 0 && (
                <div className="h-full flex items-center justify-center text-zinc-600 text-sm italic">
                  No receipts uploaded yet
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Review Panel */}
          <div className="flex flex-col overflow-hidden bg-zinc-900/20 border border-zinc-800 rounded-xl">
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/40">
              <h3 className="font-semibold text-zinc-200">Review & Verify Items</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {pendingScans.filter(s => s.status === 'completed').length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 space-y-4">
                  <div className="p-4 bg-zinc-900 rounded-full">
                    <Receipt className="w-8 h-8 opacity-20" />
                  </div>
                  <p className="text-sm italic">Scan a receipt to see the breakdown of items</p>
                </div>
              ) : (
                pendingScans.filter(s => s.status === 'completed').map(scan => (
                  <ReceiptCard 
                    key={scan.id} 
                    scan={scan as any} 
                    categories={categories} 
                    onSuccess={() => removeScan(scan.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

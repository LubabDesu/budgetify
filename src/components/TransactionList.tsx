'use client'
import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Pencil, Receipt, SquareArrowOutUpRight, Trash2, ChevronRight, ChevronDown } from "lucide-react"
import { deleteTransaction } from "@/app/actions/transactions"
import { Button } from "./ui/button"
import { Transaction, Category } from "@/types/database"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AddTransactionForm } from "./AddTransactionForm"
import { useState } from "react"

function parseLocalDate(dateValue: string) {
  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return new Date(dateValue)

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  return new Date(year, month, day)
}

export function TransactionList({
  transactions,
  categories = []
}: {
  transactions: Transaction[],
  categories?: Category[]
}) {
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const groupedTransactions = React.useMemo(() => {
    const sorted = [...transactions].sort(
      (first, second) =>
        parseLocalDate(second.date).getTime() - parseLocalDate(first.date).getTime()
    )
    const grouped = new Map<string, Transaction[]>()

    for (const transaction of sorted) {
      const dayKey = transaction.date
      const dayTransactions = grouped.get(dayKey)
      if (dayTransactions) {
        dayTransactions.push(transaction)
      } else {
        grouped.set(dayKey, [transaction])
      }
    }

    return Array.from(grouped.entries()).map(([date, dayTransactions]) => {
      const totalSpending = dayTransactions.reduce(
        (sum, transaction) => sum + Number(transaction.amount || 0),
        0
      )

      return {
        date,
        dayTransactions,
        totalSpending,
      }
    })
  }, [transactions])

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-500 bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800">
        <Receipt className="w-12 h-12 mb-4 opacity-20" />
        <p>No transactions found</p>
      </div>
    )
  }
  const handleDelete = async (id: string) => {
    if(confirm('Are you sure you want to delete this transaction?')) {
      await deleteTransaction(id)
    }
  }

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setIsEditDialogOpen(true)
  }
  

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
      <Table>
        <TableHeader className="bg-zinc-900/50">
          <TableRow className="hover:bg-transparent border-zinc-800">
            <TableHead className="w-[40px]"></TableHead>
            <TableHead className="text-zinc-400">Description</TableHead>
            <TableHead className="text-zinc-400">Category</TableHead>
            <TableHead className="text-right text-zinc-400">Amount</TableHead>
            <TableHead className="text-right text-zinc-400">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedTransactions.map((group) => (
            <React.Fragment key={group.date}>
              <TableRow className="border-zinc-800 bg-zinc-950/70 hover:bg-zinc-950/70">
                <TableCell colSpan={5} className="py-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  {format(parseLocalDate(group.date), "MMM dd, yyyy")} · {group.dayTransactions.length} transaction{group.dayTransactions.length === 1 ? '' : 's'} · ${group.totalSpending.toFixed(2)} spent
                </TableCell>
              </TableRow>
              {group.dayTransactions.map((t: Transaction) => (
                <React.Fragment key={t.id}>
                  <TableRow 
                    onClick={() => t.items && t.items.length > 0 && toggleRow(t.id)}
                    className={`border-zinc-800 hover:bg-zinc-800/30 transition-colors cursor-pointer ${expandedRows.has(t.id) ? 'bg-zinc-800/20' : ''}`}
                  >
                    <TableCell className="p-0 text-center">
                      {t.items && t.items.length > 0 && (
                        <div className="flex justify-center">
                          {expandedRows.has(t.id) ? (
                            <ChevronDown className="w-4 h-4 text-zinc-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-zinc-500" />
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-zinc-200">{t.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-300 font-normal">
                        {t.categories?.name || 'Uncategorized'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-white">
                      -${Number(t.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          onClick={() => handleEdit(t)} 
                          variant="ghost"
                          className="h-8 w-8 p-0 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-400/10"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        
                        {t.receipt_url && (
                          <a 
                            href={t.receipt_url} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-zinc-500 hover:text-emerald-400 p-2 transition-colors"
                          >
                            <SquareArrowOutUpRight className="w-4 h-4" />
                          </a>
                        )}
                        
                        <Button 
                          onClick={() => handleDelete(t.id)} 
                          variant="ghost"
                          className="h-8 w-8 p-0 text-zinc-500 hover:text-red-400 hover:bg-red-400/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Expanded Line Items Row */}
                  {expandedRows.has(t.id) && t.items && t.items.length > 0 && (
                    <TableRow className="bg-zinc-950/40 border-zinc-800 hover:bg-zinc-950/40">
                      <TableCell colSpan={5} className="p-0">
                        <div className="p-4 pl-14 space-y-2 animate-in slide-in-from-top-2 duration-200">
                          <div className="grid grid-cols-[1fr_100px] gap-4 mb-2">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Item Description</span>
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Amount</span>
                          </div>
                          {t.items.map((item) => (
                            <div key={item.id} className="grid grid-cols-[1fr_100px] gap-4 border-b border-zinc-900/50 pb-2 last:border-0">
                              <span className="text-sm text-zinc-400 italic">{item.description}</span>
                              <span className="text-sm text-zinc-400 text-right">${Number(item.amount).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-900 text-white">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
          </DialogHeader>
          {editingTransaction && (
            <AddTransactionForm 
              categories={categories}
              editId={editingTransaction.id}
              defaultValues={{
                amount: editingTransaction.amount.toString(),
                description: editingTransaction.description || '',
                category_id: editingTransaction.category_id || '',
                date: editingTransaction.date,
                items: editingTransaction.items?.map(i => ({
                  id: i.id,
                  description: i.description,
                  amount: i.amount.toString()
                })) || []
              }}
              onSuccess={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

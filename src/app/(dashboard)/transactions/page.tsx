import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TransactionList } from '@/components/TransactionList'
import { createClient } from '@/lib/supabase-server'
import { Button } from '@/components/ui/button'
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  Receipt, 
  Plus, 
  Scan,
  Repeat
} from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog'
import { AddTransactionForm } from '@/components/AddTransactionForm'
import { ReceiptScanner } from '@/components/ReceiptScanner'
import { getAllTransactions, editTransaction, deleteTransaction } from '@/app/actions/transactions'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()

  const { transactions, error } = await getAllTransactions()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user.user?.id)

  const categoryList = categories || []

  console.log('Transactions page - User ID:', user.user?.id)
  console.log('Transactions page - Data:', transactions)
  console.log('Transactions page - Error:', error)

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
          <Button variant="outline" className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800 gap-2">
            <Repeat className="w-4 h-4" />
            Quick Template
          </Button>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-500 gap-2">
                <Plus className="w-4 h-4" />
                Add Manual
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-950 border-zinc-900 text-white">
                <DialogTitle>Add Transaction</DialogTitle>
                <AddTransactionForm categories={categoryList} />
            </DialogContent>
          </Dialog>

          <ReceiptScanner categories={categoryList}>
            <Button className="bg-blue-600 hover:bg-blue-500 gap-2">
              <Scan className="w-4 h-4" />
              Scan Receipt
            </Button>
          </ReceiptScanner>
        </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-zinc-500 mt-1">View and manage all your transactions.</p>
      </div>

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionList transactions={transactions || []} categories={categoryList} />
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useState, useEffect, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  DollarSign, 
  Receipt, 
  Plus, 
  Scan,
  Repeat,
  TrendingDown,
  TrendingUp,
  Calendar,
  Layers,
  ChevronRight
} from 'lucide-react'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog'
import { ReceiptScanner } from '@/components/ReceiptScanner'
import { AddTransactionForm } from '@/components/AddTransactionForm'
import { TransactionList } from '@/components/TransactionList'
import { AnalyticsChart } from '@/components/AnalyticsChart'
import { getDashboardAnalytics, TimeRange, AnalyticsSummary } from '@/app/actions/analytics'
import { Transaction, Category } from '@/types/database'
import { toast } from 'sonner'
import Link from 'next/link'

interface DashboardClientProps {
  user: any
  categories: Category[]
  initialAnalytics: AnalyticsSummary
  recentTransactions: Transaction[]
}

export function DashboardClient({ 
  user, 
  categories, 
  initialAnalytics,
  recentTransactions 
}: DashboardClientProps) {
  const [analytics, setAnalytics] = useState<AnalyticsSummary>(initialAnalytics)
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [customMonth, setCustomMonth] = useState<string>(new Date().toISOString().slice(0, 7))
  const [isPending, startTransition] = useTransition()
  
  // Extract user info
  const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const avatarUrl = user?.user_metadata?.avatar_url

  const handleRangeChange = (range: TimeRange, month?: string) => {
    startTransition(async () => {
      try {
        const data = await getDashboardAnalytics(range, month)
        setAnalytics(data)
      } catch (error: any) {
        toast.error('Failed to update analytics')
      }
    })
  }

  return (
    <div className="space-y-10 pb-16">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-2">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="w-12 h-12 rounded-2xl border-2 border-zinc-800 shadow-xl" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <span className="text-xl font-bold text-emerald-500">{fullName[0]}</span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Welcome back, {fullName}
            </h1>
            <p className="text-zinc-500 text-sm">Here's your financial pulse for the last period.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Select 
              value={timeRange} 
              onValueChange={(val: TimeRange) => {
                setTimeRange(val)
                if (val !== 'custom') handleRangeChange(val)
              }}
            >
              <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-300 w-[170px] md:w-[190px] h-10 font-medium">
                <Calendar className="w-4 h-4 mr-2 text-zinc-500" />
                <SelectValue placeholder="Time Range" className="flex-1 truncate text-left" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="custom">Specific Month</SelectItem>
              </SelectContent>
            </Select>

            {timeRange === 'custom' && (
              <input 
                type="month" 
                value={customMonth}
                onChange={(e) => {
                  setCustomMonth(e.target.value)
                  handleRangeChange('custom', e.target.value)
                }}
                className="bg-zinc-900 border border-zinc-800 text-zinc-300 px-3 py-1.5 rounded-md h-10 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            )}
          </div>

          <div className="h-6 w-[1px] bg-zinc-800 mx-1 hidden sm:block" />

          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-500 font-bold gap-2 shadow-lg shadow-emerald-900/20">
                <Plus className="w-4 h-4" />
                Add Manual
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-950 border-zinc-900 text-white max-w-lg">
              <DialogTitle className="text-xl font-bold mb-4">Add Transaction</DialogTitle>
              <AddTransactionForm categories={categories} />
            </DialogContent>
          </Dialog>

          <ReceiptScanner categories={categories}>
            <Button variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 font-bold gap-2">
              <Scan className="w-4 h-4 text-blue-400" />
              Scan Receipt
            </Button>
          </ReceiptScanner>
        </div>
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm overflow-hidden group">
          <div className="h-1 w-full bg-emerald-500/50" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Spending</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-extrabold text-white tracking-tight">
              ${analytics.totalSpending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs mt-3 flex items-center gap-1.5 font-medium">
              {analytics.trend > 0 ? (
                <span className="text-rose-400 flex items-center gap-0.5 bg-rose-400/10 px-1.5 py-0.5 rounded">
                  <TrendingUp className="w-3 h-3" /> {Math.abs(analytics.trend).toFixed(1)}%
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-0.5 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                  <TrendingDown className="w-3 h-3" /> {Math.abs(analytics.trend).toFixed(1)}%
                </span>
              )}
              <span className="text-zinc-500">vs previous period</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm overflow-hidden">
          <div className="h-1 w-full bg-blue-500/50" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Transactions</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Receipt className="h-4 w-4 text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-extrabold text-white tracking-tight">{analytics.transactionCount}</div>
            <p className="text-xs text-zinc-500 mt-3 font-medium">Logged in this period</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm overflow-hidden lg:col-span-1 md:col-span-2">
          <div className="h-1 w-full bg-indigo-500/50" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Top Category</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <Layers className="h-4 w-4 text-indigo-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white tracking-tight truncate">
              {analytics.categoryBreakdown[0]?.name || 'N/A'}
            </div>
            <p className="text-xs text-zinc-500 mt-3 font-medium">
              ${analytics.categoryBreakdown[0]?.amount.toLocaleString() || '0.00'} spent total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts & Lists Section */}
      <div className="grid gap-8 lg:grid-cols-7">
        {/* Spending Trends Chart */}
        <Card className="lg:col-span-4 bg-[#1e1e1e]/60 border-zinc-800/50 shadow-2xl backdrop-blur-md overflow-hidden flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between px-6 py-5 border-b border-zinc-800/50">
            <div>
              <CardTitle className="text-lg font-bold text-white">Daily Spending Trends</CardTitle>
              <p className="text-xs text-zinc-500 font-medium">Visualize your output over time</p>
            </div>
            {isPending && <div className="animate-spin text-emerald-500">⏳</div>}
          </CardHeader>
          <CardContent className="p-6 h-[350px] flex-grow">
            <AnalyticsChart data={analytics.chartData} />
          </CardContent>
        </Card>

        {/* Recent Activity List */}
        <Card className="lg:col-span-3 bg-[#1e1e1e]/60 border-zinc-800/50 shadow-2xl backdrop-blur-md overflow-hidden flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between px-6 py-5 border-b border-zinc-800/50">
            <div>
              <CardTitle className="text-lg font-bold text-white">Recent Activity</CardTitle>
              <p className="text-xs text-zinc-500 font-medium">Your latest financial movements</p>
            </div>
            <Link href="/transactions">
              <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/5 flex items-center gap-1 font-bold">
                View All <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0 flex-grow overflow-auto max-h-[400px]">
            <TransactionList 
              transactions={recentTransactions} 
              categories={categories} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

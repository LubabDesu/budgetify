import { createClient } from '@/lib/supabase-server'
import { CategoryManager } from '@/components/CategoryManager'

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user?.id)
    .order('name', { ascending: true })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
        <p className="text-zinc-500 mt-1">Manage your budget categories and colors.</p>
      </div>

      <CategoryManager initialCategories={categories || []} />
    </div>
  )
}

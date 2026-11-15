import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getProcurementData } from '@/app/actions/procurement'
import { ProcurementWorkspace } from '@/components/procurement-workspace'

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')
  const records = await getProcurementData()
  return <ProcurementWorkspace records={records.map((record) => ({ ...record, amount: Number(record.amount), createdAt: record.createdAt.toISOString() }))} user={{ name: session.user.name, email: session.user.email }} />
}

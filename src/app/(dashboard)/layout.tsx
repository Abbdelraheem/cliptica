import { ReactNode } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardRootLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  return <DashboardLayout>{children}</DashboardLayout>
}

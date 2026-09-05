import { ReactNode } from 'react'
import { AdminLayout } from '@/components/admin-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminRootLayout({
  children,
}: {
  children: ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  return <AdminLayout>{children}</AdminLayout>
}
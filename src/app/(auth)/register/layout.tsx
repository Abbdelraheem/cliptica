import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your Clipzila account and start turning long videos into viral short-form clips.',
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}

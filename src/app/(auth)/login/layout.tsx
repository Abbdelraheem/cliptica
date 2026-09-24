import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Cliptica account to access your viral video clips and dashboard.',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}

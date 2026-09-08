'use client'

import { useSearchParams } from 'next/navigation'
import ProjectDetail from './project-detail'

export default function Page() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('id') ?? ''
  return <ProjectDetail projectId={projectId} />
}

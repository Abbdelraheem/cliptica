'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import ProjectDetail from './project-detail'

function ProjectDetailContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('id') ?? ''
  return <ProjectDetail projectId={projectId} />
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-champagne" />
        </div>
      }
    >
      <ProjectDetailContent />
    </Suspense>
  )
}

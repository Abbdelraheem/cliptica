'use client'

import ProjectDetail from './project-detail'

export default function Page() {
  const projectId =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') ?? '' : ''
  return <ProjectDetail projectId={projectId} />
}

import ProjectDetail from './project-detail'

export const dynamicParams = true

export async function generateStaticParams() {
  return []
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ProjectDetail projectId={id} />
}

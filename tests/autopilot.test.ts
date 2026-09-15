import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSession = vi.fn()
vi.mock('next-auth', () => ({
  getServerSession: () => mockSession(),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

const mockPrisma = {
  autoPilotChannel: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}
vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

describe('AutoPilot API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({
      user: { id: 'usr_pilot_1', email: 'creator@example.com' },
    })
  })

  it('PATCH /api/user/autopilot toggles channel active state (pause/resume)', async () => {
    const { PATCH } = await import('@/app/api/user/autopilot/route')

    mockPrisma.autoPilotChannel.findUnique.mockResolvedValue({
      id: 'ch_101',
      userId: 'usr_pilot_1',
      isActive: true,
    })

    mockPrisma.autoPilotChannel.update.mockResolvedValue({
      id: 'ch_101',
      userId: 'usr_pilot_1',
      isActive: false,
    })

    const req = new Request('http://localhost:3000/api/user/autopilot', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: 'ch_101', isActive: false }),
    })

    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.channel.isActive).toBe(false)
    expect(mockPrisma.autoPilotChannel.update).toHaveBeenCalledWith({
      where: { id: 'ch_101' },
      data: { isActive: false },
    })
  })

  it('PATCH /api/user/autopilot rejects unauthorized request when not owner', async () => {
    const { PATCH } = await import('@/app/api/user/autopilot/route')

    mockPrisma.autoPilotChannel.findUnique.mockResolvedValue({
      id: 'ch_other',
      userId: 'someone_else',
      isActive: true,
    })

    const req = new Request('http://localhost:3000/api/user/autopilot', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: 'ch_other', isActive: false }),
    })

    const res = await PATCH(req)
    expect(res.status).toBe(404)
  })

  it('PATCH /api/user/autopilot validates required channelId and boolean isActive', async () => {
    const { PATCH } = await import('@/app/api/user/autopilot/route')

    const req = new Request('http://localhost:3000/api/user/autopilot', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: 'ch_101' }), // missing isActive
    })

    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })
})

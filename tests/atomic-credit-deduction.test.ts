import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockAuth,
  mockUserFindUnique,
  mockUserUpdateMany,
  mockCreditTxCreate,
  mockJobCreate,
  mockProjectFindFirst,
  mockClipFindFirst,
  mockClipFindMany,
  mockClipUpdate,
  mockProjectUpdate,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserUpdateMany: vi.fn(),
  mockCreditTxCreate: vi.fn(),
  mockJobCreate: vi.fn(),
  mockProjectFindFirst: vi.fn(),
  mockClipFindFirst: vi.fn(),
  mockClipFindMany: vi.fn(),
  mockClipUpdate: vi.fn(),
  mockProjectUpdate: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

vi.mock('@/lib/rate-limit', () => ({
  apiMutationLimiter: null,
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/prisma', () => {
  const tx = {
    user: {
      findUnique: mockUserFindUnique,
      updateMany: mockUserUpdateMany,
    },
    creditTransaction: {
      create: mockCreditTxCreate,
    },
    processingJob: {
      create: mockJobCreate,
    },
    clip: {
      findFirst: mockClipFindFirst,
      findMany: mockClipFindMany,
      update: mockClipUpdate,
      deleteMany: vi.fn(),
    },
    project: {
      findFirst: mockProjectFindFirst,
      update: mockProjectUpdate,
    },
  }
  return {
    prisma: {
      $transaction: (cb: (t: typeof tx) => Promise<unknown>) => cb(tx),
      ...tx,
    },
  }
})

import { POST as adjustPost } from '@/app/api/projects/[id]/clips/[clipId]/adjust/route'
import { POST as purgePost } from '@/app/api/projects/[id]/clips/purge-unselected/route'

describe('Atomic Credit Deduction Guard (Phase 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: 'u1', role: 'USER' },
    })
  })

  it('adjust route: returns 402 and creates zero jobs or transactions when updateMany matches 0 rows', async () => {
    mockProjectFindFirst.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      duration: 120,
      aspectRatio: '9:16',
      framing: 'smart',
      captionStyle: 'hormozi',
    })

    // Created 30 mins ago -> free window passed -> cost = 1
    const oldDate = new Date(Date.now() - 30 * 60 * 1000)
    mockClipFindFirst.mockResolvedValue({
      id: 'c1',
      projectId: 'p1',
      userId: 'u1',
      title: 'Clip 1',
      sourceStart: 10,
      sourceEnd: 40,
      createdAt: oldDate,
      captionStyle: 'hormozi',
    })

    mockUserFindUnique.mockResolvedValue({
      id: 'u1',
      credits: 1, // initial balance check passed
    })

    // Atomic update fails (concurrent decrement happened in another request)
    mockUserUpdateMany.mockResolvedValue({ count: 0 })

    const req = new Request('http://localhost:3000/api/projects/p1/clips/c1/adjust', {
      method: 'POST',
      body: JSON.stringify({ start: 15, end: 45 }),
    })

    const res = await adjustPost(req, { params: Promise.resolve({ id: 'p1', clipId: 'c1' }) })
    expect(res.status).toBe(402)
    const json = await res.json()
    expect(json.error).toContain('Insufficient credits')
    expect(mockCreditTxCreate).not.toHaveBeenCalled()
    expect(mockJobCreate).not.toHaveBeenCalled()
  })

  it('purge route: returns 402 and creates zero transactions when updateMany matches 0 rows', async () => {
    mockProjectFindFirst.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      title: 'Project 1',
      creditsUsed: 1,
    })

    mockClipFindMany.mockResolvedValue([
      { id: 'c1' },
      { id: 'c2' },
      { id: 'c3' },
    ])

    mockUserFindUnique.mockResolvedValue({
      id: 'u1',
      role: 'USER',
      credits: 5,
    })

    // Atomic update fails (concurrent deduction)
    mockUserUpdateMany.mockResolvedValue({ count: 0 })

    const req = new Request('http://localhost:3000/api/projects/p1/clips/purge-unselected', {
      method: 'POST',
      body: JSON.stringify({ keepClipIds: ['c1', 'c2', 'c3'] }), // 3 clips - 1 already paid = 2 diff
    })

    const res = await purgePost(req, { params: Promise.resolve({ id: 'p1' }) })
    expect(res.status).toBe(402)
    const json = await res.json()
    expect(json.error).toContain('Insufficient credits')
    expect(mockCreditTxCreate).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockAuth,
  mockUserFindUnique,
  mockUserUpdateMany,
  mockCreditTxCreate,
  mockProjectFindFirst,
  mockClipFindMany,
  mockClipUpdate,
  mockClipDeleteMany,
  mockProjectUpdate,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserUpdateMany: vi.fn(),
  mockCreditTxCreate: vi.fn(),
  mockProjectFindFirst: vi.fn(),
  mockClipFindMany: vi.fn(),
  mockClipUpdate: vi.fn(),
  mockClipDeleteMany: vi.fn(),
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
      update: vi.fn(),
    },
    creditTransaction: {
      create: mockCreditTxCreate,
    },
    clip: {
      findMany: mockClipFindMany,
      update: mockClipUpdate,
      deleteMany: mockClipDeleteMany,
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

import { POST as purgePost } from '@/app/api/projects/[id]/clips/purge-unselected/route'

describe('Credits Atomic Purge Deduction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: 'usr_atomic_1', role: 'USER' },
    })
  })

  it('aborts and creates no credit transaction when updateMany returns count 0 (concurrent deduction failure)', async () => {
    mockProjectFindFirst.mockResolvedValue({
      id: 'proj_101',
      userId: 'usr_atomic_1',
      title: 'Atomic Test Video',
      creditsUsed: 1,
    })

    mockClipFindMany.mockResolvedValue([
      { id: 'clip_a', captionData: {} },
      { id: 'clip_b', captionData: {} },
      { id: 'clip_c', captionData: {} },
    ])

    mockUserFindUnique.mockResolvedValue({
      id: 'usr_atomic_1',
      role: 'USER',
      credits: 5,
    })

    // Simulate atomic update matching 0 rows because credits were spent concurrently
    mockUserUpdateMany.mockResolvedValue({ count: 0 })

    const req = new Request('http://localhost:3000/api/projects/proj_101/clips/purge-unselected', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepClipIds: ['clip_a', 'clip_b', 'clip_c'] }), // 3 clips - 1 paid = 2 diff
    })

    const res = await purgePost(req, { params: Promise.resolve({ id: 'proj_101' }) })
    expect(res.status).toBe(402)
    const json = (await res.json()) as Record<string, unknown>
    expect(json.error).toBe('Insufficient credits')
    expect(mockCreditTxCreate).not.toHaveBeenCalled()
    expect(mockClipDeleteMany).not.toHaveBeenCalled()
  })
})

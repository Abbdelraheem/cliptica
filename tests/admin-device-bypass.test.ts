import { describe, it, expect } from 'vitest'
import { assertDeviceAvailable } from '@/lib/device'

describe('Admin Device Bypass', () => {
  it('should immediately bypass device check if userRole is ADMIN', async () => {
    // Even if deviceId is anything, it should not throw
    await expect(assertDeviceAvailable('dev_admin_123', 'user_1', 'ADMIN')).resolves.toBeUndefined()
  })
})

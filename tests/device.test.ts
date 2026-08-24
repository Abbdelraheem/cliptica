import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { hashDeviceId, DeviceConflictError } from '@/lib/device'

describe('hashDeviceId', () => {
  it('produces the sha256 hex digest of the raw device id', () => {
    const expected = createHash('sha256').update('device-abc-123').digest('hex')
    expect(hashDeviceId('device-abc-123')).toBe(expected)
  })

  it('matches a known sha256 vector', () => {
    expect(hashDeviceId('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
  })

  it('is deterministic and case-sensitive', () => {
    expect(hashDeviceId('Device')).toBe(hashDeviceId('Device'))
    expect(hashDeviceId('Device')).not.toBe(hashDeviceId('device'))
  })

  it('returns a 64-char hex string', () => {
    expect(hashDeviceId('whatever')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('DeviceConflictError', () => {
  it('has a default message and proper name for instanceof checks', () => {
    const err = new DeviceConflictError()
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('DeviceConflictError')
    expect(err.message).toContain('another account')
  })

  it('accepts a custom message', () => {
    expect(new DeviceConflictError('custom').message).toBe('custom')
  })
})

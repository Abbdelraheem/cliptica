import Redis from 'ioredis'

export const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  lazyConnect: true,
})

redisConnection.on('connect', () => console.log('Redis connected'))
redisConnection.on('error', (err) => console.error('Redis error:', err))
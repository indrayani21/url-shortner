const { GenericContainer } = require('testcontainers');
const Redis = require('ioredis');

describe('Redis Basic Operations Integration', () => {
  let redisContainer;
  let redisClient;

  beforeAll(async () => {
    // Start real Redis container
    redisContainer = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start();
    
    const redisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
    redisClient = new Redis(redisUrl);
  }, 30000);

  afterAll(async () => {
    if (redisClient) await redisClient.quit();
    if (redisContainer) await redisContainer.stop();
  });

  beforeEach(async () => {
    if (redisClient) await redisClient.flushall();
  });

  it('should allow setting and getting keys', async () => {
    await redisClient.set('test-key', 'test-value');
    const value = await redisClient.get('test-key');
    expect(value).toBe('test-value');
  });

  it('should support TTL expiration', async () => {
    await redisClient.setex('expiring-key', 2, 'temp-value');
    
    let value = await redisClient.get('expiring-key');
    expect(value).toBe('temp-value');
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    value = await redisClient.get('expiring-key');
    expect(value).toBeNull();
  }, 10000);

  it('should support atomic increment operations', async () => {
    const key = 'counter';
    
    const val1 = await redisClient.incr(key);
    const val2 = await redisClient.incr(key);
    const val3 = await redisClient.incr(key);
    
    expect(val1).toBe(1);
    expect(val2).toBe(2);
    expect(val3).toBe(3);
  });

  it('should support sorted sets (ZSET) for sliding windows', async () => {
    const key = 'sliding-window';
    const now = Date.now();
    
    // Add timestamps to sorted set
    await redisClient.zadd(key, now - 5000, 'req1');
    await redisClient.zadd(key, now - 3000, 'req2');
    await redisClient.zadd(key, now - 1000, 'req3');
    
    // Count requests in last 4 seconds
    const count = await redisClient.zcount(key, now - 4000, now);
    expect(count).toBe(2); // req2 and req3
  });
});
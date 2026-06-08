// tests/redis.test.js
describe('Redis Configuration', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should export get and setEx functions', () => {
    delete process.env.REDIS_URL;
    
    const redis = require('../config/redis');
    
    expect(redis).toHaveProperty('get');
    expect(redis).toHaveProperty('setEx');  // ← Changed from 'set' to 'setEx'
    expect(typeof redis.get).toBe('function');
    expect(typeof redis.setEx).toBe('function');  // ← Changed
  });

  it('should return null for get when REDIS_URL not set', async () => {
    delete process.env.REDIS_URL;
    
    const redis = require('../config/redis');
    const result = await redis.get('key');
    
    expect(result).toBeNull();
  });

  it('should return null for setEx when REDIS_URL not set', async () => {
    delete process.env.REDIS_URL;
    
    const redis = require('../config/redis');
    const result = await redis.setEx('key', 3600, 'value');
    
    expect(result).toBeNull();
  });
});
// // tests/redis.test.js
// describe('Redis Configuration', () => {
//   let originalEnv;
//   let mockRedisClient;

//   beforeEach(() => {
//     originalEnv = process.env;
//     process.env = { ...originalEnv };
//     jest.resetModules();
//     jest.clearAllMocks();
//   });

//   afterEach(() => {
//     process.env = originalEnv;
//   });

//   it('should return null for get when REDIS_URL is not set', async () => {
//     delete process.env.REDIS_URL;
    
//     const redis = require('../config/redis');
    
//     const result = await redis.get('some-key');
//     expect(result).toBeNull();
//   });

//   it('should return null for setEx when REDIS_URL is not set', async () => {
//     delete process.env.REDIS_URL;
    
//     const redis = require('../config/redis');
    
//     const result = await redis.setEx('key', 3600, 'value');
//     expect(result).toBeNull();
//   });

//   it('should export get and setEx functions even without Redis', () => {
//     delete process.env.REDIS_URL;
    
//     const redis = require('../config/redis');
    
//     expect(redis).toHaveProperty('get');
//     expect(redis).toHaveProperty('setEx');
//     expect(typeof redis.get).toBe('function');
//     expect(typeof redis.setEx).toBe('function');
//   });

//   it('should initialize Redis when REDIS_URL is set', async () => {
//     process.env.REDIS_URL = 'redis://localhost:6379';
    
//     // Mock the redis module
//     jest.doMock('redis', () => ({
//       createClient: jest.fn(() => ({
//         on: jest.fn().mockReturnThis(),
//         connect: jest.fn().mockResolvedValue(undefined),
//         get: jest.fn(),
//         setEx: jest.fn()
//       }))
//     }));
    
//     const redis = require('../config/redis');
    
//     // Small delay for async connection
//     await new Promise(resolve => setTimeout(resolve, 50));
    
//     expect(redis).toBeDefined();
//     expect(typeof redis.get).toBe('function');
//     expect(typeof redis.setEx).toBe('function');
//   });
// });
const { GenericContainer } = require('testcontainers');
const Redis = require('ioredis');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const urlRoutes = require('../../routes/url');

// Create mock Redis that we'll update after container starts
let mockRedisClient = null;

// Mock the redis module BEFORE importing anything that uses it
jest.mock('../../config/redis', () => ({
  get: async (key) => mockRedisClient ? mockRedisClient.get(key) : null,
  setEx: async (key, ttl, value) => mockRedisClient ? mockRedisClient.setex(key, ttl, value) : null,
}));

describe('Complete URL Workflow Integration', () => {
  let mongoServer;
  let redisContainer;
  let redisClient;
  let app;

  beforeAll(async () => {
    // Setup MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Redis container
    redisContainer = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start();
    
    const redisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
    redisClient = new Redis(redisUrl);
    
    // Set the mock client to use the real Redis
    mockRedisClient = redisClient;

    // Create express app
    app = express();
    app.use(express.json());
    app.use('/api', urlRoutes);
    
    // Add redirect endpoint (mirroring your server.js logic)
    app.get('/:code', async (req, res) => {
      const Url = require('../../models/Url');
      const code = req.params.code;
      
      try {
        // Try Redis cache first
        let cachedUrl = await mockRedisClient.get(code);
        if (cachedUrl) {
          // Async update click count
          Url.findOneAndUpdate({ shortCode: code }, { $inc: { clicks: 1 } }).exec();
          return res.redirect(cachedUrl);
        }
        
        // Fallback to MongoDB
        const url = await Url.findOne({ shortCode: code });
        if (!url) {
          return res.status(404).send('Not found');
        }
        
        // Check expiry
        if (url.expiresAt && url.expiresAt < new Date()) {
          return res.status(410).send('Link expired');
        }
        
        // Cache for future requests
        await mockRedisClient.setex(code, 3600, url.longUrl);
        
        // Update click count
        url.clicks += 1;
        await url.save();
        
        res.redirect(url.longUrl);
      } catch (err) {
        console.error('Redirect error:', err);
        res.status(500).send('Server error');
      }
    });
  }, 30000); // Increased timeout for container startup

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    if (redisClient) await redisClient.quit();
    if (redisContainer) await redisContainer.stop();
    mockRedisClient = null;
  });

  afterEach(async () => {
    // Clean up MongoDB collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      if (collections[key] && collections[key].deleteMany) {
        await collections[key].deleteMany({});
      }
    }
    // Clean up Redis
    if (redisClient) await redisClient.flushall();
  });

  it('should complete full flow: create → cache → redirect → analytics', async () => {
    // 1️⃣ Create short URL
    const createRes = await request(app)
      .post('/api/shorten')
      .send({ longUrl: 'https://workflow-test.com' });
    
    expect(createRes.status).toBe(200);
    const shortCode = createRes.body.shortCode;
    expect(shortCode).toBeDefined();

    // 2️⃣ First redirect (should hit DB, then cache)
    const redirect1 = await request(app)
      .get(`/${shortCode}`)
      .expect(302);
    
    expect(redirect1.headers.location).toBe('https://workflow-test.com');

    // 3️⃣ Verify cache was set
    const cached = await redisClient.get(shortCode);
    expect(cached).toBe('https://workflow-test.com');

    // 4️⃣ Second redirect (should hit cache only)
    const redirect2 = await request(app)
      .get(`/${shortCode}`)
      .expect(302);
    
    expect(redirect2.headers.location).toBe('https://workflow-test.com');

    // 5️⃣ Check analytics shows 2 clicks
    const analytics = await request(app)
      .get(`/api/analytics/${shortCode}`)
      .expect(200);
    
    expect(analytics.body.clicks).toBe(2);
  }, 10000);

  it('should return 404 for non-existent code', async () => {
    await request(app)
      .get('/nonexistent999')
      .expect(404);
  });

  it('should handle custom aliases correctly', async () => {
    // Create with custom alias
    const createRes = await request(app)
      .post('/api/shorten')
      .send({ 
        longUrl: 'https://custom-alias.com',
        customCode: 'mycustom123'
      })
      .expect(200);
    
    expect(createRes.body.shortCode).toBe('mycustom123');
    
    // Test redirect
    const redirect = await request(app)
      .get('/mycustom123')
      .expect(302);
    
    expect(redirect.headers.location).toBe('https://custom-alias.com');
    
    // Check analytics
    const analytics = await request(app)
      .get('/api/analytics/mycustom123')
      .expect(200);
    
    expect(analytics.body.clicks).toBe(1);
  });
});
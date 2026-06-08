const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const urlRoutes = require('../routes/url');  // ✅ lowercase 'url', NOT 'Url'

// Mock Redis
jest.mock('../config/redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  setEx: jest.fn().mockResolvedValue('OK')
}));

const app = express();
app.use(express.json());
app.use('/api', urlRoutes);

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  jest.clearAllMocks();
});

describe('URL Routes', () => {
  describe('POST /api/shorten', () => {
    it('should create a short URL with valid input', async () => {
      const response = await request(app)
        .post('/api/shorten')
        .send({ longUrl: 'https://www.google.com' })
        .expect(200);
      
      expect(response.body).toHaveProperty('shortCode');
      expect(response.body).toHaveProperty('longUrl', 'https://www.google.com');
      expect(response.body.shortCode).toHaveLength(8);
    });

    it('should reject invalid URL format', async () => {
      const response = await request(app)
        .post('/api/shorten')
        .send({ longUrl: 'not-a-url' })
        .expect(400);
      
      expect(response.body).toBe('Invalid URL');
    });

    it('should accept custom alias', async () => {
      const response = await request(app)
        .post('/api/shorten')
        .send({ 
          longUrl: 'https://custom.com',
          customCode: 'mycustom'
        })
        .expect(200);
      
      expect(response.body.shortCode).toBe('mycustom');
    });

    it('should reject duplicate custom alias', async () => {
      await request(app)
        .post('/api/shorten')
        .send({ 
          longUrl: 'https://first.com',
          customCode: 'duplicate'
        });
      
      const response = await request(app)
        .post('/api/shorten')
        .send({ 
          longUrl: 'https://second.com',
          customCode: 'duplicate'
        })
        .expect(400);
      
      expect(response.body).toBe('Custom alias already taken');
    });

    it('should set expiry when provided', async () => {
      const response = await request(app)
        .post('/api/shorten')
        .send({ 
          longUrl: 'https://expiring.com',
          expiry: 7
        })
        .expect(200);
      
      expect(response.body.expiresAt).toBeDefined();
    });
  });

  describe('GET /api/analytics/:shortCode', () => {
    it('should return analytics for existing URL', async () => {
      // First create a URL
      const createRes = await request(app)
        .post('/api/shorten')
        .send({ longUrl: 'https://analytics.com' });
      
      const shortCode = createRes.body.shortCode;
      
      // Then get analytics
      const response = await request(app)
        .get(`/api/analytics/${shortCode}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('longUrl', 'https://analytics.com');
      expect(response.body).toHaveProperty('shortCode', shortCode);
      expect(response.body).toHaveProperty('clicks', 0);
    });

    it('should return 404 for non-existent shortCode', async () => {
      await request(app)
        .get('/api/analytics/nonexistent123')
        .expect(404);
    });
  });
});
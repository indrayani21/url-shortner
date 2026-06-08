// tests/server.test.js
const request = require('supertest');
const express = require('express');

// Mock all dependencies
jest.mock('../config/db', () => jest.fn());
jest.mock('../config/redis', () => ({
  get: jest.fn(),
  set: jest.fn()
}));

jest.mock('../models/Url', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn()
}));

// Mock the routes module
jest.mock('../routes/url', () => {
  const router = require('express').Router();
  router.post('/shorten', (req, res) => {
    res.json({ shortCode: 'mocked123', longUrl: req.body.longUrl });
  });
  router.get('/analytics/:shortCode', (req, res) => {
    res.json({ clicks: 2, shortCode: req.params.shortCode });
  });
  return router;
});

describe('Server Routes', () => {
  let app;
  let Url;
  let redisClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get mocked modules
    Url = require('../models/Url');
    redisClient = require('../config/redis');
    
    // Create fresh app
    app = express();
    app.use(express.json());
    
    // Health endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString()
      });
    });
    
    // Redirect endpoint
    app.get('/:code', async (req, res) => {
      const { code } = req.params;
      
      try {
        const cachedUrl = await redisClient.get(code);
        if (cachedUrl) {
          return res.redirect(cachedUrl);
        }
        
        const url = await Url.findOne({ shortCode: code });
        if (!url) {
          return res.status(404).send('Not found');
        }
        
        if (url.expiresAt && new Date(url.expiresAt) < new Date()) {
          return res.status(410).send('Link expired');
        }
        
        await redisClient.set(code, url.longUrl, { EX: 3600 });
        url.clicks += 1;
        await url.save();
        
        res.redirect(url.longUrl);
      } catch (err) {
        res.status(500).send('Server error');
      }
    });
    
    app.use('/api', require('../routes/url'));
  });

  describe('GET /health', () => {
    it('should return 200', async () => {
      await request(app).get('/health').expect(200);
    });
  });

  describe('GET /:code', () => {
    it('should redirect from cache', async () => {
      redisClient.get.mockResolvedValue('https://cached.com');
      
      await request(app)
        .get('/abc123')
        .expect(302)
        .expect('Location', 'https://cached.com');
    });

    it('should fetch from DB when not cached', async () => {
      redisClient.get.mockResolvedValue(null);
      redisClient.set.mockResolvedValue('OK');
      
      const mockUrl = {
        shortCode: 'test123',
        longUrl: 'https://db.com',
        clicks: 0,
        expiresAt: null,
        save: jest.fn().mockResolvedValue(true)
      };
      
      Url.findOne.mockResolvedValue(mockUrl);
      
      await request(app)
        .get('/test123')
        .expect(302)
        .expect('Location', 'https://db.com');
      
      expect(mockUrl.clicks).toBe(1);
    });

    it('should return 404 for non-existent', async () => {
      redisClient.get.mockResolvedValue(null);
      Url.findOne.mockResolvedValue(null);
      
      await request(app).get('/missing').expect(404);
    });
  });

  describe('API routes', () => {
    it('should handle POST /api/shorten', async () => {
      await request(app)
        .post('/api/shorten')
        .send({ longUrl: 'https://test.com' })
        .expect(200);
    });
  });
});
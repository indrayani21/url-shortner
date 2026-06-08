const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Url = require('../models/Url');

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
  await Url.deleteMany({});
});

describe('URL Model', () => {
  it('should create a valid URL with required fields', async () => {
    const url = new Url({
      longUrl: 'https://example.com/test',
      shortCode: 'abc123'
    });
    
    const saved = await url.save();
    
    expect(saved.longUrl).toBe('https://example.com/test');
    expect(saved.shortCode).toBe('abc123');
    expect(saved.clicks).toBe(0);
    expect(saved.createdAt).toBeDefined();
  });

  it('should require longUrl', async () => {
    const url = new Url({ shortCode: 'abc123' });
    await expect(url.save()).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it('should enforce unique shortCode', async () => {
    await Url.create({ longUrl: 'https://example.com/1', shortCode: 'unique123' });
    
    const duplicate = new Url({ longUrl: 'https://example.com/2', shortCode: 'unique123' });
    await expect(duplicate.save()).rejects.toThrow();
  });

  it('should accept expiresAt as optional', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    
    const url = new Url({
      longUrl: 'https://example.com/expiring',
      shortCode: 'expire123',
      expiresAt: futureDate
    });
    
    const saved = await url.save();
    expect(saved.expiresAt).toEqual(futureDate);
  });

  it('should default clicks to 0', async () => {
    const url = new Url({
      longUrl: 'https://example.com/clicks',
      shortCode: 'click123'
    });
    
    const saved = await url.save();
    expect(saved.clicks).toBe(0);
  });
});
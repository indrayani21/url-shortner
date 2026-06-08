// tests/db.test.js

// Mock mongoose BEFORE importing anything
jest.mock('mongoose', () => ({
  connect: jest.fn().mockResolvedValue({}),
  connection: {
    on: jest.fn(),
    once: jest.fn(),
    readyState: 1
  }
}));

describe('Database Connection', () => {
  let originalEnv;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should export connectDB function', () => {
    const connectDB = require('../config/db');
    expect(typeof connectDB).toBe('function');
  });

  it('should call mongoose.connect with MONGO_URI', async () => {
    process.env.MONGO_URI = 'mongodb://localhost:27017/testdb';
    
    // Get the mock after importing
    const mongoose = require('mongoose');
    const connectDB = require('../config/db');
    
    await connectDB();
    
    expect(mongoose.connect).toHaveBeenCalledTimes(1);
    expect(mongoose.connect).toHaveBeenCalledWith('mongodb://localhost:27017/testdb');
  });

  it('should handle connection errors and exit', async () => {
    process.env.MONGO_URI = 'mongodb://invalid:27017/testdb';
    
    const mongoose = require('mongoose');
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    
    // Make the connect fail
    mongoose.connect.mockRejectedValueOnce(new Error('Connection failed'));
    
    const connectDB = require('../config/db');
    await connectDB();
    
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);
    
    mockExit.mockRestore();
  });
});
// // tests/db.test.js
// const mongoose = require('mongoose');

// // Mock mongoose
// jest.mock('mongoose', () => ({
//   connect: jest.fn().mockResolvedValue({}),
//   connection: {
//     on: jest.fn(),
//     once: jest.fn(),
//     readyState: 1
//   }
// }));

// describe('Database Connection', () => {
//   let originalEnv;
//   let consoleLogSpy;
//   let consoleErrorSpy;
  
//   beforeEach(() => {
//     originalEnv = process.env;
//     process.env = { ...originalEnv };
//     jest.clearAllMocks();
//     consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
//     consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
//   });

//   afterEach(() => {
//     process.env = originalEnv;
//     jest.resetModules();
//     consoleLogSpy.mockRestore();
//     consoleErrorSpy.mockRestore();
//   });

//   it('should export a connectDB function', () => {
//     jest.resetModules();
//     const connectDB = require('../config/db');
//     expect(typeof connectDB).toBe('function');
//   });

//   it('should attempt to connect to MongoDB with MONGO_URI', async () => {
//     jest.resetModules();
//     process.env.MONGO_URI = 'mongodb://localhost:27017/testdb';
    
//     const connectDB = require('../config/db');
//     await connectDB();
    
//     // Check that mongoose.connect was called
//     expect(mongoose.connect).toHaveBeenCalled();
//     expect(mongoose.connect.mock.calls[0][0]).toBe('mongodb://localhost:27017/testdb');
//   });

//   it('should handle connection errors gracefully', async () => {
//     jest.resetModules();
//     process.env.MONGO_URI = 'mongodb://invalid:27017/testdb';
    
//     // Temporarily override mongoose.connect to fail
//     const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
//     mongoose.connect.mockRejectedValueOnce(new Error('Connection failed'));
    
//     const connectDB = require('../config/db');
//     await connectDB();
    
//     expect(consoleErrorSpy).toHaveBeenCalled();
//     expect(mockExit).toHaveBeenCalledWith(1);
    
//     mockExit.mockRestore();
//   });
// });
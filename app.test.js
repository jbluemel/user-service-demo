const request = require('supertest');

// We'll create the app without starting the server for testing
const express = require('express');
const app = express();

// Copy the middleware and routes from app.js for testing
app.use(express.json());

let users = [];
let nextId = 1;

// Health endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0'
  });
});

app.get('/ready', (req, res) => {
  res.status(200).json({ 
    status: 'ready',
    natsConnected: false // For testing, we'll assume NATS is not connected
  });
});

// API endpoints
app.get('/api/users', (req, res) => {
  res.json({
    users: users,
    count: users.length
  });
});

app.get('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json(user);
});

app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ 
      error: 'Name and email are required' 
    });
  }
  
  const user = {
    id: nextId++,
    name,
    email,
    createdAt: new Date().toISOString()
  };
  
  users.push(user);
  res.status(201).json(user);
});

app.get('/api/version', (req, res) => {
  res.json({
    version: process.env.APP_VERSION || '1.0.0',
    buildTime: process.env.BUILD_TIME || 'development',
    gitCommit: process.env.GIT_COMMIT || 'unknown'
  });
});

describe('User Service API', () => {
  beforeEach(() => {
    // Reset users array before each test
    users = [];
    nextId = 1;
  });

  describe('Health Checks', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
      expect(response.body.version).toBeDefined();
    });

    test('GET /ready should return ready status', async () => {
      const response = await request(app)
        .get('/ready')
        .expect(200);
      
      expect(response.body.status).toBe('ready');
    });
  });

  describe('User Management', () => {
    test('GET /api/users should return empty array initially', async () => {
      const response = await request(app)
        .get('/api/users')
        .expect(200);
      
      expect(response.body.users).toEqual([]);
      expect(response.body.count).toBe(0);
    });

    test('POST /api/users should create a new user', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com'
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);
      
      expect(response.body.id).toBe(1);
      expect(response.body.name).toBe(userData.name);
      expect(response.body.email).toBe(userData.email);
      expect(response.body.createdAt).toBeDefined();
    });

    test('POST /api/users should validate required fields', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: 'John Doe' }) // Missing email
        .expect(400);
      
      expect(response.body.error).toBe('Name and email are required');
    });

    test('GET /api/users/:id should return specific user', async () => {
      // First create a user
      const userData = {
        name: 'Jane Doe',
        email: 'jane@example.com'
      };

      const createResponse = await request(app)
        .post('/api/users')
        .send(userData);

      const userId = createResponse.body.id;

      // Then get the user
      const response = await request(app)
        .get(`/api/users/${userId}`)
        .expect(200);
      
      expect(response.body.name).toBe(userData.name);
      expect(response.body.email).toBe(userData.email);
    });

    test('GET /api/users/:id should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/users/999')
        .expect(404);
      
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('Version Info', () => {
    test('GET /api/version should return version information', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);
      
      expect(response.body.version).toBeDefined();
      expect(response.body.buildTime).toBeDefined();
      expect(response.body.gitCommit).toBeDefined();
    });
  });
});

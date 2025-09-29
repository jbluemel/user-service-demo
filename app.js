const express = require('express');
const { Client } = require('nats');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// In-memory store (in production, you'd use a database)
let users = [];
let nextId = 1;

// NATS client for event publishing
let nats = null;

// Initialize NATS connection
async function initNATS() {
  try {
    nats = await Client.connect({ 
      servers: process.env.NATS_URL || 'nats://nats:4222' 
    });
    console.log('Connected to NATS');
  } catch (error) {
    console.log('NATS connection failed:', error.message);
    console.log('Continuing without NATS integration');
  }
}

// Health check endpoint - critical for Kubernetes readiness/liveness probes
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0'
  });
});

// Readiness check - can be different from health in real apps
app.get('/ready', (req, res) => {
  res.status(200).json({ 
    status: 'ready',
    natsConnected: nats !== null
  });
});

// Get all users
app.get('/api/users', (req, res) => {
  res.json({
    users: users,
    count: users.length
  });
});

// Get user by ID
app.get('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json(user);
});

// Create new user
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
  
  // Publish event to NATS (if connected)
  if (nats) {
    try {
      await nats.publish('user.created', JSON.stringify(user));
      console.log('Published user.created event:', user.id);
    } catch (error) {
      console.error('Failed to publish event:', error);
    }
  }
  
  res.status(201).json(user);
});

// Update user
app.put('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const { name, email } = req.body;
  users[userIndex] = {
    ...users[userIndex],
    name: name || users[userIndex].name,
    email: email || users[userIndex].email,
    updatedAt: new Date().toISOString()
  };
  
  res.json(users[userIndex]);
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  users.splice(userIndex, 1);
  res.status(204).send();
});

// Version endpoint - useful for verifying deployments
app.get('/api/version', (req, res) => {
  res.json({
    version: process.env.APP_VERSION || '1.0.0',
    buildTime: process.env.BUILD_TIME || 'development',
    gitCommit: process.env.GIT_COMMIT || 'unknown'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(port, async () => {
  console.log(`User service listening on port ${port}`);
  await initNATS();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (nats) {
    await nats.close();
  }
  process.exit(0);
});

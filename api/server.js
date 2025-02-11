const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Handle GET requests for debugging or fetching data
app.get('/api/server', async (req, res) => {
  res.json({ message: 'GET request to /api/server is working!' });
});

// Handle POST requests (forward to worker)
app.post('/api/server', async (req, res) => {
  try {
    // Forward the request to the worker service
    const response = await axios.post(
      'https://news-pearl-one.vercel.app/worker.js', // Ensure this is correct
      req.body,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization || '',
        },
      }
    );

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Error forwarding request:', error.message);
    res.status(500).json({ error: 'Failed to process the request' });
  }
});

// Default route
app.get('/', (req, res) => {
  res.send('Welcome to My Server!');
});

// Export for Vercel
module.exports = app;
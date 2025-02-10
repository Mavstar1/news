const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// POST request to forward to worker.js
app.post('/api/server', async (req, res) => {
  try {
    // Forward the request to /api/worker (serverless function)
    const response = await axios.post(
      'https://your-vercel-project.vercel.app/api/worker', // Correct API path
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

// Instead of app.listen(), export the Express app as a function for Vercel
module.exports = app;

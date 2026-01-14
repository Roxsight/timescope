const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

let heartbeats = [];

app.post('/heartbeat', (req, res) => {
    const { timestamp } = req.body;
    console.log(`Received heartbeat at: ${timestamp}`);
    
    heartbeats.push({
        timestamp: timestamp,
        receivedAt: new Date().toISOString()
    });
    
    // Keep only last 100 heartbeats
    if (heartbeats.length > 100) {
        heartbeats.shift();
    }
    
    res.status(200).json({ message: 'Heartbeat received' });
});

app.get('/heartbeats', (req, res) => {
    res.json(heartbeats);
});

app.listen(PORT, () => {
    console.log(`TimeScope Server running on http://localhost:${PORT}`);
});

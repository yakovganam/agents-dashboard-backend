const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetryController');

// Existing routes
router.get('/status', telemetryController.getStatus.bind(telemetryController));
router.get('/agent/:id/logs', telemetryController.getAgentLogs.bind(telemetryController));

// New sync route
router.post('/sync', (req, res) => {
    const { sessions, timestamp } = req.body;
    if (!sessions) return res.status(400).json({ error: 'No sessions provided' });
    
    // For now, we'll store this in memory or just log it to verify
    console.log(`📡 Cloud Sync: Received ${sessions.length} sessions at ${new Date(timestamp).toISOString()}`);
    
    // We can extend telemetryController to handle actual DB storage later
    res.json({ success: true, count: sessions.length });
});

module.exports = router;

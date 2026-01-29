const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetryController');

router.get('/status', telemetryController.getStatus.bind(telemetryController));
router.get('/agent/:id/logs', telemetryController.getAgentLogs.bind(telemetryController));

module.exports = router;

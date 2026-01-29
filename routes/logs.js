const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');

router.get('/:id/logs', logController.getLogs.bind(logController));
router.post('/:id/logs', logController.addLog.bind(logController));
router.delete('/:id/logs', logController.clearLogs.bind(logController));
router.get('/:id/logs/export', logController.exportLogs.bind(logController));

module.exports = router;

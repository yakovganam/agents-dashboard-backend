const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');

router.get('/', agentController.getAllAgents.bind(agentController));
router.get('/stats', agentController.getStats.bind(agentController));
router.get('/:id', agentController.getAgent.bind(agentController));
router.post('/', agentController.createAgent.bind(agentController));
router.post('/:id/update-status', agentController.updateStatus.bind(agentController));
router.post('/:id/control', agentController.controlAgent.bind(agentController));
router.delete('/:id', agentController.deleteAgent.bind(agentController));

module.exports = router;

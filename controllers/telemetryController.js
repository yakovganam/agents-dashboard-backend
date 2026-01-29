const database = require('../db/database');
const { getConnectionCount } = require('../websocket');

class TelemetryController {
    // GET /api/telemetry/status
    async getStatus(req, res) {
        try {
            // Basic aggregation from DB
            const agents = await database.getAllAgents();

            // Map to minimal status view
            const status = agents.map(a => ({
                id: a.id,
                name: a.name || a.id,
                status: a.status || 'unknown',
                lastActivity: a.lastActivity || a.updatedAt || null
            }));

            res.json({
                timestamp: Date.now(),
                connectionCount: getConnectionCount(),
                agents: status
            });
        } catch (error) {
            console.error('Telemetry getStatus error:', error);
            res.status(500).json({ error: 'Failed to fetch telemetry status', message: error.message });
        }
    }

    // GET /api/telemetry/agent/:id/logs
    async getAgentLogs(req, res) {
        try {
            const agentId = req.params.id;
            const logs = await database.getLogsForAgent(agentId);
            res.json({ agentId, logs });
        } catch (error) {
            console.error('Telemetry getAgentLogs error:', error);
            res.status(500).json({ error: 'Failed to fetch agent logs', message: error.message });
        }
    }
}

module.exports = new TelemetryController();

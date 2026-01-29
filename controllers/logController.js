const database = require('../db/database');
const { broadcastEvent } = require('../websocket');

class LogController {
    // GET /api/agents/:id/logs
    async getLogs(req, res) {
        try {
            const { id } = req.params;
            const limit = parseInt(req.query.limit) || 1000;
            
            const logs = await database.getLogsByAgentId(id, limit);
            res.json(logs);
        } catch (error) {
            console.error('Error fetching logs:', error);
            res.status(500).json({ error: 'Failed to fetch logs' });
        }
    }

    // POST /api/agents/:id/logs
    async addLog(req, res) {
        try {
            const { id } = req.params;
            const { message, level } = req.body;

            const log = await database.addLog({
                agentId: id,
                message,
                level: level || 'info'
            });

            // Broadcast to WebSocket clients
            broadcastEvent('log-update', {
                agentId: id,
                log
            });

            res.status(201).json(log);
        } catch (error) {
            console.error('Error adding log:', error);
            res.status(500).json({ error: 'Failed to add log' });
        }
    }

    // DELETE /api/agents/:id/logs
    async clearLogs(req, res) {
        try {
            const { id } = req.params;
            const result = await database.clearLogs(id);
            
            broadcastEvent('logs-cleared', { agentId: id });
            
            res.json({ success: true, deleted: result.deleted });
        } catch (error) {
            console.error('Error clearing logs:', error);
            res.status(500).json({ error: 'Failed to clear logs' });
        }
    }

    // GET /api/agents/:id/logs/export
    async exportLogs(req, res) {
        try {
            const { id } = req.params;
            const logs = await database.getLogsByAgentId(id, 10000);
            const agent = await database.getAgentById(id);

            if (!agent) {
                return res.status(404).json({ error: 'Agent not found' });
            }

            // Format logs as text
            let content = `Agent Logs Export\n`;
            content += `Agent: ${agent.name} (${agent.id})\n`;
            content += `Model: ${agent.model}\n`;
            content += `Status: ${agent.status}\n`;
            content += `Created: ${new Date(agent.createdAt).toISOString()}\n`;
            content += `\n${'='.repeat(80)}\n\n`;

            logs.forEach(log => {
                const timestamp = new Date(log.timestamp).toISOString();
                content += `[${timestamp}] [${log.level.toUpperCase()}] ${log.message}\n`;
            });

            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename="agent-${id}-logs.txt"`);
            res.send(content);
        } catch (error) {
            console.error('Error exporting logs:', error);
            res.status(500).json({ error: 'Failed to export logs' });
        }
    }
}

module.exports = new LogController();

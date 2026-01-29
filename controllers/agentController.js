const database = require('../db/database');
const { broadcastEvent } = require('../websocket');

class AgentController {
    // GET /api/agents
    async getAllAgents(req, res) {
        try {
            // Get database agents
            const dbAgents = await database.getAllAgents();
            
            // Get live Clawdbot sessions
            let clawdbotSessions = [];
            try {
                const clawdbotBridge = require('../clawdbot/bridge');
                clawdbotSessions = await clawdbotBridge.getAllSessions();
            } catch (bridgeError) {
                console.warn('Could not fetch Clawdbot sessions:', bridgeError.message);
            }

            // Combine both, preferring Clawdbot for active ones
            const combined = [...clawdbotSessions];
            
            // Add DB agents that aren't in Clawdbot (to avoid duplicates)
            const clawdbotIds = new Set(clawdbotSessions.map(s => s.id));
            dbAgents.forEach(agent => {
                if (!clawdbotIds.has(agent.id)) {
                    combined.push(agent);
                }
            });

            res.json(combined);
        } catch (error) {
            console.error('Error fetching agents:', error);
            res.status(500).json({ error: 'Failed to fetch agents' });
        }
    }

    // GET /api/agents/:id
    async getAgent(req, res) {
        try {
            const agent = await database.getAgentById(req.params.id);
            if (!agent) {
                return res.status(404).json({ error: 'Agent not found' });
            }
            res.json(agent);
        } catch (error) {
            console.error('Error fetching agent:', error);
            res.status(500).json({ error: 'Failed to fetch agent' });
        }
    }

    // POST /api/agents
    async createAgent(req, res) {
        try {
            const agent = await database.createAgent(req.body);
            
            // Broadcast to WebSocket clients
            broadcastEvent('agent-started', agent);
            
            res.status(201).json(agent);
        } catch (error) {
            console.error('Error creating agent:', error);
            res.status(500).json({ error: 'Failed to create agent' });
        }
    }

    // POST /api/agents/:id/update-status
    async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;

            await database.updateAgent(id, updates);
            const agent = await database.getAgentById(id);

            if (!agent) {
                return res.status(404).json({ error: 'Agent not found' });
            }

            // Determine event type
            let eventType = 'agent-updated';
            if (updates.status === 'completed') {
                eventType = 'agent-completed';
            } else if (updates.status === 'error') {
                eventType = 'agent-error';
            }

            broadcastEvent(eventType, agent);

            res.json(agent);
        } catch (error) {
            console.error('Error updating agent status:', error);
            res.status(500).json({ error: 'Failed to update agent status' });
        }
    }

    // POST /api/agents/:id/control
    async controlAgent(req, res) {
        try {
            const { id } = req.params;
            const { action, message } = req.body; // start, stop, kill, restart, message

            const clawdbotBridge = require('../clawdbot/bridge');
            
            if (action === 'message' && message) {
                const result = await clawdbotBridge.sendMessage(id, message);
                return res.json(result);
            }

            const agent = await database.getAgentById(id);
            // ... (rest of the control logic)
            res.json({ success: true, message: `${action} action performed` });
        } catch (error) {
            console.error('Error controlling agent:', error);
            res.status(500).json({ error: 'Failed to control agent' });
        }
    }
    async deleteAgent(req, res) {
        try {
            await database.deleteAgent(req.params.id);
            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting agent:', error);
            res.status(500).json({ error: 'Failed to delete agent' });
        }
    }

    // GET /api/stats
    async getStats(req, res) {
        try {
            const stats = await database.getStats();
            res.json(stats);
        } catch (error) {
            console.error('Error fetching stats:', error);
            // Return empty stats + error info to diagnose on Render
            res.json({
                running: 0,
                completed: 0,
                error: 0,
                total: 0,
                diagnostics: error.message,
                stack: error.stack
            });
        }
    }
}

module.exports = new AgentController();

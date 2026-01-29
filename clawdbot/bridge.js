const fs = require('fs');
const path = require('path');

class ClawdbotBridge {
    constructor() {
        this.initialized = false;
        // Search in possible Clawdbot locations
        this.basePath = path.join(process.env.USERPROFILE, '.clawdbot');
        this.agentsPath = path.join(this.basePath, 'agents', 'main');
        this.sessionsJsonPath = path.join(this.agentsPath, 'sessions', 'sessions.json');
        this.sessionsDir = path.join(this.agentsPath, 'sessions');
        this.cache = new Map();
        this.lastPoll = 0;
    }

    async initialize() {
        if (!fs.existsSync(this.sessionsJsonPath)) {
            throw new Error(`Clawdbot sessions not found at ${this.sessionsJsonPath}`);
        }
        this.initialized = true;
        return true;
    }

    async getActiveSessions() {
        if (!this.initialized) await this.initialize();
        
        try {
            const data = fs.readFileSync(this.sessionsJsonPath, 'utf8');
            const sessionsMap = JSON.parse(data);
            const sessions = Object.values(sessionsMap);
            
            // Filter: active in the last 10 minutes
            const now = Date.now();
            return sessions.filter(s => (now - s.updatedAt) < 10 * 60 * 1000);
        } catch (error) {
            console.error('Error reading sessions:', error);
            return [];
        }
    }

    async getAllSessions() {
        if (!this.initialized) await this.initialize();
        try {
            const data = fs.readFileSync(this.sessionsJsonPath, 'utf8');
            return Object.values(JSON.parse(data));
        } catch (error) {
            return [];
        }
    }

    async getSessionDetails(sessionId) {
        const sessions = await this.getAllSessions();
        return sessions.find(s => s.sessionId === sessionId || s.key === sessionId);
    }

    async getSessionLogs(sessionId) {
        try {
            // Transcript is usually [sessionId].jsonl
            // We need to find the correct file. sessionId is a UUID.
            const session = await this.getSessionDetails(sessionId);
            const actualSessionId = session ? session.sessionId : sessionId;
            
            const transcriptPath = path.join(this.sessionsDir, `${actualSessionId}.jsonl`);
            if (!fs.existsSync(transcriptPath)) return [];

            const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
            return lines
                .filter(l => l.trim())
                .map(l => JSON.parse(l));
        } catch (error) {
            console.error('Error reading logs:', error);
            return [];
        }
    }

    async getSessionsByFilter(filter) {
        let sessions = await this.getAllSessions();
        
        if (filter.status === 'active') {
            const now = Date.now();
            sessions = sessions.filter(s => (now - s.updatedAt) < 5 * 60 * 1000);
        }
        
        if (filter.model) {
            sessions = sessions.filter(s => s.model && s.model.includes(filter.model));
        }

        // Sorting
        const sortBy = filter.sortBy || 'updatedAt';
        const order = filter.sortOrder === 'asc' ? 1 : -1;
        
        sessions.sort((a, b) => (a[sortBy] > b[sortBy] ? 1 : -1) * order);

        if (filter.limit) {
            sessions = sessions.slice(0, filter.limit);
        }

        return sessions;
    }

    async getStatistics() {
        const sessions = await this.getAllSessions();
        const now = Date.now();
        const active = sessions.filter(s => (now - s.updatedAt) < 5 * 60 * 1000);
        
        return {
            totalSessions: sessions.length,
            activeSessions: active.length,
            models: [...new Set(sessions.map(s => s.model).filter(Boolean))],
            lastUpdate: now
        };
    }

    clearCache() {
        this.cache.clear();
    }
}

// Export singleton
module.exports = new ClawdbotBridge();

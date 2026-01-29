const fs = require('fs').promises;

/**
 * Clawdbot Sessions Parser
 * Parses and validates sessions.json data
 */
class SessionsParser {
    /**
     * Parse sessions.json file
     */
    static async parseSessionsFile(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(data);
            return parsed;
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.warn('Sessions file not found, returning empty sessions');
                return { sessions: [] };
            }
            throw new Error(`Failed to parse sessions file: ${error.message}`);
        }
    }

    /**
     * Extract active sessions (updated in last 5 minutes)
     */
    static getActiveSessions(sessionsData, maxAgeMs = 5 * 60 * 1000) {
        if (!sessionsData || !Array.isArray(sessionsData.sessions)) {
            return [];
        }

        const now = Date.now();
        return sessionsData.sessions.filter(session => {
            const lastActivity = session.updatedAt || session.createdAt;
            return lastActivity && (now - lastActivity < maxAgeMs);
        });
    }

    /**
     * Extract all sessions
     */
    static getAllSessions(sessionsData) {
        if (!sessionsData || !Array.isArray(sessionsData.sessions)) {
            return [];
        }
        return sessionsData.sessions;
    }

    /**
     * Find session by ID
     */
    static findSessionById(sessionsData, sessionId) {
        if (!sessionsData || !Array.isArray(sessionsData.sessions)) {
            return null;
        }
        return sessionsData.sessions.find(s => s.id === sessionId);
    }

    /**
     * Calculate session statistics
     */
    static calculateStats(sessions) {
        const now = Date.now();
        const activeSessions = sessions.filter(s => {
            const lastActivity = s.updatedAt || s.createdAt;
            return lastActivity && (now - lastActivity < 5 * 60 * 1000);
        });

        const totalTokens = sessions.reduce((sum, s) => sum + (s.totalTokens || 0), 0);
        const totalInputTokens = sessions.reduce((sum, s) => sum + (s.inputTokens || 0), 0);
        const totalOutputTokens = sessions.reduce((sum, s) => sum + (s.outputTokens || 0), 0);

        const models = [...new Set(sessions.map(s => s.model).filter(Boolean))];

        const durations = sessions
            .filter(s => s.startTime && s.lastActivity)
            .map(s => (s.lastActivity || s.updatedAt) - s.startTime);
        
        const avgDuration = durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0;

        return {
            totalSessions: sessions.length,
            activeSessions: activeSessions.length,
            idleSessions: sessions.length - activeSessions.length,
            totalTokens,
            totalInputTokens,
            totalOutputTokens,
            models,
            avgSessionDuration: Math.round(avgDuration),
            lastUpdate: now
        };
    }

    /**
     * Transform session for API response
     */
    static transformSession(session) {
        const now = Date.now();
        const lastActivity = session.updatedAt || session.createdAt;
        const isActive = lastActivity && (now - lastActivity < 5 * 60 * 1000);

        return {
            id: session.id,
            sessionKey: session.sessionKey || session.id,
            kind: session.kind || 'unknown',
            model: session.model || 'unknown',
            contextTokens: session.contextTokens || 200000,
            inputTokens: session.inputTokens || 0,
            outputTokens: session.outputTokens || 0,
            totalTokens: session.totalTokens || 0,
            startTime: session.startTime || session.createdAt,
            lastActivity: lastActivity,
            status: isActive ? 'running' : 'idle',
            aborted: session.aborted || false,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
        };
    }

    /**
     * Transform multiple sessions
     */
    static transformSessions(sessions) {
        return sessions.map(s => this.transformSession(s));
    }
}

module.exports = SessionsParser;

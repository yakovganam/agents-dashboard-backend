const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Clawdbot Bridge
 * Provides access to real Clawdbot session data
 */
class ClawdbotBridge {
    constructor() {
        this.basePath = null;
        this.sessionsCache = null;
        this.initialized = false;
    }

    /**
     * Initialize the bridge by locating the Clawdbot directory
     */
    async initialize() {
        if (this.initialized) return;

        // Common locations for Clawdbot
        const possiblePaths = [
            process.env.CLAWDBOT_HOME,
            path.join(os.homedir(), '.clawdbot'),
            'C:\\Users\\yakov\\.clawdbot'
        ].filter(Boolean);

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                this.basePath = p;
                console.log(`✅ Clawdbot located at: ${this.basePath}`);
                break;
            }
        }

        if (!this.basePath) {
            console.error('❌ Could not locate Clawdbot directory');
            throw new Error('Clawdbot directory not found');
        }

        this.initialized = true;
    }

    /**
     * Clear the local cache to force re-reading files
     */
    clearCache() {
        this.sessionsCache = null;
    }

    /**
     * Get all active sessions from Clawdbot
     * Maps real Clawdbot sessions to the dashboard structure
     */
    async getAllSessions() {
        if (!this.initialized) await this.initialize();

        try {
            const sessionsJsonPath = path.join(this.basePath, 'agents', 'main', 'sessions', 'sessions.json');
            
            if (!fs.existsSync(sessionsJsonPath)) {
                console.warn(`⚠️  sessions.json not found at: ${sessionsJsonPath}`);
                return [];
            }

            const sessionsData = JSON.parse(fs.readFileSync(sessionsJsonPath, 'utf8'));
            const dashboardSessions = [];

            for (const [key, session] of Object.entries(sessionsData)) {
                // Determine status based on updatedAt
                const now = Date.now();
                const updatedAgo = now - (session.updatedAt || 0);
                const isActive = updatedAgo < 60000; // Active if updated in the last minute

                dashboardSessions.push({
                    id: session.sessionId || key,
                    name: session.label || key,
                    label: session.label || key,
                    model: session.model || 'unknown',
                    provider: session.modelProvider || 'unknown',
                    status: isActive ? 'running' : 'completed',
                    progress: isActive ? 50 : 100,
                    inputTokens: session.inputTokens || 0,
                    outputTokens: session.outputTokens || 0,
                    totalTokens: session.totalTokens || 0,
                    contextTokens: session.contextTokens || 0,
                    updatedAt: session.updatedAt || 0,
                    lastActivity: session.updatedAt || 0,
                    channel: session.channel || session.lastChannel || 'internal',
                    origin: session.origin || null,
                    startTime: session.createdAt || session.updatedAt || now,
                    task: session.label || 'Clawdbot Session'
                });
            }

            return dashboardSessions;
        } catch (error) {
            console.error('Error reading Clawdbot sessions:', error.message);
            return [];
        }
    }

    /**
     * Get sessions by filter
     */
    async getSessionsByFilter(filter = {}) {
        const sessions = await this.getAllSessions();
        let filtered = [...sessions];

        if (filter.model) {
            filtered = filtered.filter(s => s.model === filter.model);
        }

        if (filter.status) {
            filtered = filtered.filter(s => s.status === filter.status);
        }

        return filtered;
    }

    /**
     * Get specific session details
     */
    async getSessionDetails(sessionId) {
        const sessions = await this.getAllSessions();
        return sessions.find(s => s.id === sessionId);
    }

    /**
     * Get history for a specific session
     * Reads the .jsonl file for the session
     */
    async getSessionLogs(sessionId) {
        return this.getSessionHistory(sessionId);
    }

    /**
     * Kill a session (mock)
     */
    async killSession(sessionId) {
        console.log(`Killing session ${sessionId}`);
        return { success: true };
    }

    /**
     * Restart a session (mock)
     */
    async restartSession(sessionId) {
        console.log(`Restarting session ${sessionId}`);
        return { success: true };
    }

    /**
     * Get statistics summary
     */
    async getStatistics() {
        const sessions = await this.getAllSessions();
        const activeSessions = sessions.filter(s => s.status === 'running').length;
        const idleSessions = sessions.filter(s => s.status === 'completed').length;
        const totalTokens = sessions.reduce((sum, s) => sum + (s.totalTokens || 0), 0);
        const models = [...new Set(sessions.map(s => s.model))].filter(Boolean);
        
        // Calculate average duration
        let totalDuration = 0;
        let sessionsWithDuration = 0;
        sessions.forEach(s => {
            if (s.startTime && s.updatedAt) {
                totalDuration += (s.updatedAt - s.startTime);
                sessionsWithDuration++;
            }
        });

        return {
            activeSessions,
            idleSessions,
            totalSessions: sessions.length,
            totalTokens,
            avgSessionDuration: sessionsWithDuration > 0 ? totalDuration / sessionsWithDuration : 0,
            models
        };
    }

    /**
     * Get history for a specific session
     * Reads the .jsonl file for the session
     */
    async getSessionHistory(sessionId) {
        if (!this.initialized) await this.initialize();

        try {
            const sessionFile = path.join(this.basePath, 'agents', 'main', 'sessions', `${sessionId}.jsonl`);
            
            if (!fs.existsSync(sessionFile)) {
                return [];
            }

            const lines = fs.readFileSync(sessionFile, 'utf8').split('\n').filter(Boolean);
            return lines.map(line => JSON.parse(line));
        } catch (error) {
            console.error(`Error reading history for session ${sessionId}:`, error.message);
            return [];
        }
    }
}

module.exports = new ClawdbotBridge();

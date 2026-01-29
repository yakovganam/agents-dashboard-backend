const clawdbotBridge = require('../clawdbot/bridge');
const logWatcher = require('./logWatcher');

/**
 * Session Watcher
 * Monitors Clawdbot sessions and broadcasts changes via WebSocket
 */
class SessionWatcher {
    constructor(websocketServer) {
        this.ws = websocketServer;
        this.lastState = new Map();
        this.interval = null;
        this.pollInterval = 3000; // 3 seconds
        this.isRunning = false;
    }

    /**
     * Start watching sessions
     */
    async start() {
        if (this.isRunning) {
            console.warn('SessionWatcher already running');
            return;
        }

        try {
            // Initialize bridge if needed
            await clawdbotBridge.initialize();
            
            // Initialize log watcher
            await logWatcher.initialize();

            // Initial state
            await this.poll();

            // Start polling
            this.interval = setInterval(() => this.poll(), this.pollInterval);
            this.isRunning = true;

            console.log(`✅ SessionWatcher started (polling every ${this.pollInterval}ms)`);
        } catch (error) {
            console.error('❌ Failed to start SessionWatcher:', error.message);
            throw error;
        }
    }

    /**
     * Stop watching sessions
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        logWatcher.stopAll();
        this.isRunning = false;
        console.log('⏹️  SessionWatcher stopped');
    }

    /**
     * Poll for changes
     */
    async poll() {
        try {
            // Clear cache to get fresh data
            clawdbotBridge.clearCache();
            
            const sessions = await clawdbotBridge.getAllSessions();
            const currentSessionIds = new Set();

            // Check each session
            for (const session of sessions) {
                currentSessionIds.add(session.id);
                const lastKnown = this.lastState.get(session.id);

                if (!lastKnown) {
                    // New session detected
                    this.handleSessionStarted(session);
                } else {
                    // Check for updates
                    if (this.hasSessionChanged(lastKnown, session)) {
                        this.handleSessionUpdated(session, lastKnown);
                    }
                }

                // Update state
                this.lastState.set(session.id, this.cloneSession(session));
            }

            // Check for completed/removed sessions
            for (const [sessionId, lastSession] of this.lastState.entries()) {
                if (!currentSessionIds.has(sessionId)) {
                    this.handleSessionCompleted(lastSession);
                    this.lastState.delete(sessionId);
                }
            }

            // Broadcast stats update
            const stats = await clawdbotBridge.getStatistics();
            this.ws.broadcastEvent('stats-updated', stats);

        } catch (error) {
            console.error('Error in SessionWatcher poll:', error.message);
        }
    }

    /**
     * Handle new session started
     */
    handleSessionStarted(session) {
        console.log(`🆕 New session started: ${session.id} (${session.model})`);
        this.ws.broadcastEvent('session-started', session);
        
        // Start watching logs for active sessions
        if (session.status === 'active' || session.status === 'running') {
            logWatcher.watchSession(session.id);
        }
    }

    /**
     * Handle session updated
     */
    handleSessionUpdated(session, lastSession) {
        const changes = this.getSessionChanges(lastSession, session);
        console.log(`🔄 Session updated: ${session.id}`, changes);
        this.ws.broadcastEvent('session-updated', {
            session,
            changes
        });

        // Toggle log watching based on status
        if ((session.status === 'active' || session.status === 'running') && 
            !(lastSession.status === 'active' || lastSession.status === 'running')) {
            logWatcher.watchSession(session.id);
        } else if (!(session.status === 'active' || session.status === 'running') && 
                   (lastSession.status === 'active' || lastSession.status === 'running')) {
            // Optional: keep watching or stop
        }
    }

    /**
     * Handle session completed
     */
    handleSessionCompleted(session) {
        console.log(`✅ Session completed: ${session.id}`);
        this.ws.broadcastEvent('session-completed', session);
        
        // Stop watching logs
        logWatcher.unwatchSession(session.id);
    }

    /**
     * Check if session has changed
     */
    hasSessionChanged(oldSession, newSession) {
        // Check key fields for changes
        return (
            oldSession.totalTokens !== newSession.totalTokens ||
            oldSession.inputTokens !== newSession.inputTokens ||
            oldSession.outputTokens !== newSession.outputTokens ||
            oldSession.status !== newSession.status ||
            oldSession.lastActivity !== newSession.lastActivity ||
            oldSession.updatedAt !== newSession.updatedAt
        );
    }

    /**
     * Get detailed changes between sessions
     */
    getSessionChanges(oldSession, newSession) {
        const changes = {};

        if (oldSession.totalTokens !== newSession.totalTokens) {
            changes.totalTokens = {
                old: oldSession.totalTokens,
                new: newSession.totalTokens,
                delta: newSession.totalTokens - oldSession.totalTokens
            };
        }

        if (oldSession.inputTokens !== newSession.inputTokens) {
            changes.inputTokens = {
                old: oldSession.inputTokens,
                new: newSession.inputTokens,
                delta: newSession.inputTokens - oldSession.inputTokens
            };
        }

        if (oldSession.outputTokens !== newSession.outputTokens) {
            changes.outputTokens = {
                old: oldSession.outputTokens,
                new: newSession.outputTokens,
                delta: newSession.outputTokens - oldSession.outputTokens
            };
        }

        if (oldSession.status !== newSession.status) {
            changes.status = {
                old: oldSession.status,
                new: newSession.status
            };
        }

        return changes;
    }

    /**
     * Clone session object
     */
    cloneSession(session) {
        return JSON.parse(JSON.stringify(session));
    }

    /**
     * Get current state
     */
    getCurrentState() {
        return {
            isRunning: this.isRunning,
            trackedSessions: this.lastState.size,
            pollInterval: this.pollInterval
        };
    }
}

module.exports = SessionWatcher;

const express = require('express');
const router = express.Router();
const clawdbotBridge = require('../clawdbot/bridge');

/**
 * GET /api/clawdbot/sessions
 * Get all sessions (active + idle)
 */
router.get('/sessions', async (req, res) => {
    try {
        const filter = {
            status: req.query.status,
            model: req.query.model,
            kind: req.query.kind,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            sortBy: req.query.sortBy || 'updatedAt',
            sortOrder: req.query.sortOrder || 'desc',
            limit: req.query.limit ? parseInt(req.query.limit) : undefined
        };

        // Remove undefined values
        Object.keys(filter).forEach(key => 
            filter[key] === undefined && delete filter[key]
        );

        const sessions = await clawdbotBridge.getSessionsByFilter(filter);
        
        res.json({
            success: true,
            count: sessions.length,
            sessions
        });
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/clawdbot/sessions/active
 * Get only active sessions
 */
router.get('/sessions/active', async (req, res) => {
    try {
        const sessions = await clawdbotBridge.getActiveSessions();
        
        res.json({
            success: true,
            count: sessions.length,
            sessions
        });
    } catch (error) {
        console.error('Error fetching active sessions:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/clawdbot/sessions/:sessionId
 * Get specific session details
 */
router.get('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await clawdbotBridge.getSessionDetails(sessionId);
        
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        res.json({
            success: true,
            session
        });
    } catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/clawdbot/sessions/:sessionId/logs
 * Get session logs/messages
 */
router.get('/sessions/:sessionId/logs', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const logs = await clawdbotBridge.getSessionLogs(sessionId);
        
        res.json({
            success: true,
            count: logs.length,
            logs
        });
    } catch (error) {
        console.error('Error fetching session logs:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/clawdbot/sessions/:sessionId/kill
 * Kill a session
 */
router.post('/sessions/:sessionId/kill', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = await clawdbotBridge.killSession(sessionId);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/clawdbot/sessions/:sessionId/restart
 * Restart a session
 */
router.post('/sessions/:sessionId/restart', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = await clawdbotBridge.restartSession(sessionId);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/clawdbot/stats
 * Get overall statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await clawdbotBridge.getStatistics();
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/clawdbot/refresh
 * Force refresh cache
 */
router.post('/refresh', async (req, res) => {
    try {
        clawdbotBridge.clearCache();
        const sessions = await clawdbotBridge.getAllSessions();
        
        res.json({
            success: true,
            message: 'Cache refreshed',
            count: sessions.length
        });
    } catch (error) {
        console.error('Error refreshing cache:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/clawdbot/health
 * Health check for Clawdbot integration
 */
router.get('/health', async (req, res) => {
    try {
        await clawdbotBridge.initialize();
        const stats = await clawdbotBridge.getStatistics();
        
        res.json({
            success: true,
            status: 'connected',
            sessions: stats.totalSessions,
            active: stats.activeSessions,
            timestamp: Date.now()
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            status: 'disconnected',
            error: error.message,
            timestamp: Date.now()
        });
    }
});

module.exports = router;

const express = require('express');
const cors = require('cors');
const http = require('http');
const database = require('./db/database');
const { initializeWebSocket, getConnectionCount, getWebSocketServer } = require('./websocket');
const clawdbotBridge = require('./clawdbot/bridge');
const SessionWatcher = require('./watchers/sessionWatcher');

// Routes
const agentsRouter = require('./routes/agents');
const logsRouter = require('./routes/logs');
const clawdbotRouter = require('./routes/clawdbot');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/agents', agentsRouter);
app.use('/api/logs', logsRouter);
app.use('/api/clawdbot', clawdbotRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: Date.now(),
        connections: getConnectionCount()
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path
    });
});

// Initialize database and start server
let sessionWatcher = null;

async function startServer() {
    try {
        // Initialize database
        await database.initialize();
        console.log('Database initialized successfully');

        // Initialize Clawdbot Bridge
        try {
            await clawdbotBridge.initialize();
            console.log('✅ Clawdbot integration initialized');
        } catch (error) {
            console.warn('⚠️  Clawdbot integration failed:', error.message);
            console.warn('   Dashboard will work without live Clawdbot data');
        }

        // Create HTTP server
        const server = http.createServer(app);

        // Initialize WebSocket
        const wsServer = initializeWebSocket(server);
        console.log('WebSocket server initialized');

        // Start Session Watcher
        try {
            sessionWatcher = new SessionWatcher(wsServer);
            await sessionWatcher.start();
        } catch (error) {
            console.warn('⚠️  SessionWatcher failed to start:', error.message);
        }

        // Start listening
        server.listen(PORT, () => {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`🚀 Agents Dashboard Backend`);
            console.log(`${'='.repeat(60)}`);
            console.log(`📡 HTTP Server:      http://localhost:${PORT}`);
            console.log(`🔌 WebSocket Server: ws://localhost:${PORT}`);
            console.log(`💾 Database:         SQLite (agents.db)`);
            console.log(`🔗 Clawdbot:         ${clawdbotBridge.initialized ? '✅ Connected' : '❌ Disconnected'}`);
            console.log(`👀 Session Watcher:  ${sessionWatcher?.isRunning ? '✅ Running' : '❌ Stopped'}`);
            console.log(`${'='.repeat(60)}\n`);
        });

        // Graceful shutdown
        const shutdown = async () => {
            console.log('\n\nShutting down gracefully...');
            if (sessionWatcher) {
                sessionWatcher.stop();
            }
            await database.close();
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

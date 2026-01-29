const fs = require('fs');
const path = require('path');
const { broadcastEvent } = require('../websocket');
const config = require('../clawdbot/config');

/**
 * Log Watcher
 * Watches .jsonl files for new entries and streams them via WebSocket
 */
class LogWatcher {
    constructor() {
        this.watchers = new Map(); // sessionId -> { watcher, lastSize }
        this.sessionsDir = null;
    }

    /**
     * Initialize the log watcher
     */
    async initialize() {
        await config.initialize();
        this.sessionsDir = path.join(config.getClawdbotDir(), 'agents', 'main', 'sessions');
        console.log(`✅ LogWatcher initialized. Watching: ${this.sessionsDir}`);
    }

    /**
     * Start watching logs for a specific session
     * @param {string} sessionId 
     */
    watchSession(sessionId) {
        if (this.watchers.has(sessionId)) {
            return;
        }

        const logFilePath = path.join(this.sessionsDir, `${sessionId}.jsonl`);

        if (!fs.existsSync(logFilePath)) {
            console.warn(`Log file not found for session ${sessionId}: ${logFilePath}`);
            return;
        }

        const stats = fs.statSync(logFilePath);
        let lastSize = stats.size;

        console.log(`👁️  Watching logs for session ${sessionId}`);

        const watcher = fs.watch(logFilePath, (eventType) => {
            if (eventType === 'change') {
                this.handleFileChange(sessionId, logFilePath, lastSize)
                    .then(newSize => {
                        lastSize = newSize;
                    })
                    .catch(err => console.error(`Error reading log file ${logFilePath}:`, err));
            }
        });

        this.watchers.set(sessionId, { watcher, lastSize });
    }

    /**
     * Stop watching logs for a specific session
     * @param {string} sessionId 
     */
    unwatchSession(sessionId) {
        const entry = this.watchers.get(sessionId);
        if (entry) {
            entry.watcher.close();
            this.watchers.delete(sessionId);
            console.log(`⏹️  Stopped watching logs for session ${sessionId}`);
        }
    }

    /**
     * Stop all watchers
     */
    stopAll() {
        for (const [sessionId, entry] of this.watchers.entries()) {
            entry.watcher.close();
        }
        this.watchers.clear();
        console.log('⏹️  All log watchers stopped');
    }

    /**
     * Handle file change event
     */
    async handleFileChange(sessionId, filePath, lastSize) {
        const stats = fs.statSync(filePath);
        const newSize = stats.size;

        if (newSize <= lastSize) {
            return newSize;
        }

        // Read the new content
        const stream = fs.createReadStream(filePath, {
            start: lastSize,
            end: newSize - 1,
            encoding: 'utf8'
        });

        let remaining = '';
        stream.on('data', (chunk) => {
            const lines = (remaining + chunk).split('\n');
            remaining = lines.pop(); // Last line might be incomplete

            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const logEntry = JSON.parse(line);
                        this.streamLogEntry(sessionId, logEntry);
                    } catch (e) {
                        // Not a valid JSON or partial line
                        console.warn(`Skipping invalid log line in ${sessionId}: ${line.substring(0, 50)}...`);
                    }
                }
            }
        });

        return new Promise((resolve) => {
            stream.on('end', () => {
                // Handle any remaining content if it's a complete line
                if (remaining.trim()) {
                    try {
                        const logEntry = JSON.parse(remaining);
                        this.streamLogEntry(sessionId, logEntry);
                    } catch (e) {
                        // Possibly incomplete line
                    }
                }
                resolve(newSize);
            });
        });
    }

    /**
     * Stream log entry to frontend
     */
    streamLogEntry(sessionId, logEntry) {
        // Transform Clawdbot log entry to dashboard format if needed
        const dashboardLog = this.transformLog(logEntry);
        
        broadcastEvent('log-update', {
            agentId: sessionId,
            log: dashboardLog
        });
    }

    /**
     * Transform Clawdbot log format to Dashboard log format
     */
    transformLog(entry) {
        // Base dashboard log structure: { id, agentId, message, level, timestamp }
        
        let message = '';
        let level = 'info';
        
        if (entry.type === 'message') {
            const msg = entry.message;
            if (msg.role === 'user') {
                message = `User: ${this.extractText(msg.content)}`;
                level = 'user';
            } else if (msg.role === 'assistant') {
                if (msg.content) {
                    message = `Assistant: ${this.extractText(msg.content)}`;
                } else if (msg.toolCalls) {
                    message = `Assistant calling tools: ${msg.toolCalls.map(tc => tc.name).join(', ')}`;
                }
                level = 'assistant';
            } else if (msg.role === 'toolResult') {
                message = `Tool ${msg.toolName} returned: ${this.extractText(msg.content).substring(0, 200)}...`;
                level = 'tool';
            }
        } else if (entry.type === 'log') {
            message = entry.message || JSON.stringify(entry.data || entry);
            level = entry.level || 'info';
        } else if (entry.type === 'error') {
            message = entry.message || entry.error || 'Unknown error';
            level = 'error';
        } else {
            message = `[${entry.type}] ${JSON.stringify(entry.data || entry).substring(0, 200)}`;
        }

        return {
            id: entry.id || Math.random().toString(36).substring(7),
            timestamp: entry.timestamp || new Date().toISOString(),
            message,
            level,
            raw: entry // Keep raw for debugging or detailed view
        };
    }

    extractText(content) {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
            return content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('\n');
        }
        return JSON.stringify(content);
    }
}

// Singleton
const logWatcher = new LogWatcher();

module.exports = logWatcher;

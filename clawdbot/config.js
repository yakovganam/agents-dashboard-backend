const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Clawdbot Configuration Manager
 * Reads Clawdbot settings and locates session files
 */
class ClawdbotConfig {
    constructor() {
        this.clawdbotDir = null;
        this.sessionsPath = null;
        this.config = null;
    }

    /**
     * Initialize configuration
     */
    async initialize() {
        try {
            // Find Clawdbot directory
            const homeDir = os.homedir();
            this.clawdbotDir = path.join(homeDir, '.clawdbot');

            // Check if Clawdbot directory exists
            try {
                await fs.access(this.clawdbotDir);
            } catch (error) {
                throw new Error(`Clawdbot directory not found at ${this.clawdbotDir}`);
            }

            // Set sessions path
            this.sessionsPath = path.join(
                this.clawdbotDir,
                'agents',
                'main',
                'sessions',
                'sessions.json'
            );

            // Try to read Clawdbot config
            try {
                const configPath = path.join(this.clawdbotDir, 'config.json');
                const configData = await fs.readFile(configPath, 'utf8');
                this.config = JSON.parse(configData);
            } catch (error) {
                console.warn('Could not read Clawdbot config.json, using defaults');
                this.config = {};
            }

            console.log('✅ Clawdbot config initialized');
            console.log(`   📁 Clawdbot dir: ${this.clawdbotDir}`);
            console.log(`   📄 Sessions file: ${this.sessionsPath}`);

            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Clawdbot config:', error.message);
            throw error;
        }
    }

    /**
     * Get sessions file path
     */
    getSessionsPath() {
        return this.sessionsPath;
    }

    /**
     * Get Clawdbot directory
     */
    getClawdbotDir() {
        return this.clawdbotDir;
    }

    /**
     * Get session directory path for a specific session
     */
    getSessionDir(sessionId) {
        return path.join(
            this.clawdbotDir,
            'agents',
            'main',
            'sessions',
            sessionId
        );
    }

    /**
     * Get configuration value
     */
    getConfig(key, defaultValue = null) {
        return this.config?.[key] ?? defaultValue;
    }
}

// Singleton instance
const config = new ClawdbotConfig();

module.exports = config;

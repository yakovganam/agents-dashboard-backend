const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'agents.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

class Database {
    constructor() {
        this.db = null;
    }

    initialize() {
        return new Promise((resolve, reject) => {
            // Use :memory: if we're in a restricted environment or if specified
            const dbSource = process.env.NODE_ENV === 'production' ? ':memory:' : DB_PATH;
            
            this.db = new sqlite3.Database(dbSource, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    reject(err);
                    return;
                }
                
                console.log(`Connected to SQLite database (${dbSource})`);
                
                try {
                    // Load and execute schema
                    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
                    this.db.exec(schema, (err) => {
                        if (err) {
                            console.error('Error creating schema:', err);
                            reject(err);
                            return;
                        }
                        console.log('Database schema initialized');
                        resolve();
                    });
                } catch (schemaErr) {
                    console.error('Error reading schema file:', schemaErr);
                    reject(schemaErr);
                }
            });
        });
    }

    // Agents queries
    getAllAgents() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM agents ORDER BY createdAt DESC', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    getAgentById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM agents WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    createAgent(agent) {
        const { id, name, label, model, task, status, progress, startTime, tokensIn, tokensOut } = agent;
        const now = Date.now();
        
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO agents (id, name, label, model, task, status, progress, startTime, tokensIn, tokensOut, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, name, label || name, model, task, status, progress || 0, startTime, tokensIn || 0, tokensOut || 0, now, now],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id, ...agent, createdAt: now, updatedAt: now });
                }
            );
        });
    }

    updateAgent(id, updates) {
        const now = Date.now();
        const fields = [];
        const values = [];

        Object.keys(updates).forEach(key => {
            if (key !== 'id') {
                fields.push(`${key} = ?`);
                values.push(updates[key]);
            }
        });

        fields.push('updatedAt = ?');
        values.push(now);
        values.push(id);

        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE agents SET ${fields.join(', ')} WHERE id = ?`,
                values,
                function(err) {
                    if (err) reject(err);
                    else resolve({ updated: this.changes });
                }
            );
        });
    }

    deleteAgent(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM agents WHERE id = ?', [id], function(err) {
                if (err) reject(err);
                else resolve({ deleted: this.changes });
            });
        });
    }

    // Logs queries
    getLogsByAgentId(agentId, limit = 1000) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM logs WHERE agentId = ? ORDER BY timestamp DESC LIMIT ?',
                [agentId, limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.reverse()); // Return in chronological order
                }
            );
        });
    }

    addLog(log) {
        const { agentId, message, level } = log;
        const timestamp = Date.now();

        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO logs (agentId, message, timestamp, level) VALUES (?, ?, ?, ?)',
                [agentId, message, timestamp, level || 'info'],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, agentId, message, timestamp, level });
                }
            );
        });
    }

    clearLogs(agentId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM logs WHERE agentId = ?', [agentId], function(err) {
                if (err) reject(err);
                else resolve({ deleted: this.changes });
            });
        });
    }

    // Analytics
    getStats() {
        return new Promise((resolve, reject) => {
            const queries = [
                () => new Promise((res, rej) => this.db.get('SELECT COUNT(*) as total FROM agents', [], (err, row) => err ? rej(err) : res(row))),
                () => new Promise((res, rej) => this.db.get('SELECT COUNT(*) as running FROM agents WHERE status = "running"', [], (err, row) => err ? rej(err) : res(row))),
                () => new Promise((res, rej) => this.db.get('SELECT COUNT(*) as completed FROM agents WHERE status = "completed"', [], (err, row) => err ? rej(err) : res(row))),
                () => new Promise((res, rej) => this.db.get('SELECT COUNT(*) as errors FROM agents WHERE status = "error"', [], (err, row) => err ? rej(err) : res(row)))
            ];

            Promise.all(queries.map(q => q()))
                .then(results => {
                    resolve({
                        total: results[0]?.total || 0,
                        running: results[1]?.running || 0,
                        completed: results[2]?.completed || 0,
                        errors: results[3]?.errors || 0,
                        avgCompletionTime: 0,
                        dailyUsage: [],
                        hourlyUsage: []
                    });
                })
                .catch(reject);
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

module.exports = new Database();

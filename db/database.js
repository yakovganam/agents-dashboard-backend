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
            this.db = new sqlite3.Database(DB_PATH, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    reject(err);
                    return;
                }
                
                console.log('Connected to SQLite database');
                
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
                this.db.get.bind(this.db, 'SELECT COUNT(*) as total FROM agents', []),
                this.db.get.bind(this.db, 'SELECT COUNT(*) as running FROM agents WHERE status = "running"', []),
                this.db.get.bind(this.db, 'SELECT COUNT(*) as completed FROM agents WHERE status = "completed"', []),
                this.db.get.bind(this.db, 'SELECT COUNT(*) as errors FROM agents WHERE status = "error"', []),
                this.db.get.bind(this.db, 'SELECT AVG(endTime - startTime) as avgTime FROM agents WHERE endTime IS NOT NULL', []),
                // Token usage by day
                this.db.all.bind(this.db, `
                    SELECT 
                        strftime('%Y-%m-%d', datetime(createdAt / 1000, 'unixepoch')) as date,
                        SUM(tokensIn + tokensOut) as totalTokens,
                        SUM(tokensIn) as tokensIn,
                        SUM(tokensOut) as tokensOut
                    FROM agents 
                    GROUP BY date 
                    ORDER BY date DESC 
                    LIMIT 30
                `, []),
                // Token usage by hour (last 24 hours)
                this.db.all.bind(this.db, `
                    SELECT 
                        strftime('%H:00', datetime(createdAt / 1000, 'unixepoch')) as hour,
                        SUM(tokensIn + tokensOut) as totalTokens,
                        SUM(tokensIn) as tokensIn,
                        SUM(tokensOut) as tokensOut
                    FROM agents 
                    WHERE createdAt > ?
                    GROUP BY hour 
                    ORDER BY hour ASC
                `, [Date.now() - 24 * 60 * 60 * 1000])
            ];

            Promise.all(queries.map(q => new Promise((res, rej) => q((err, row) => err ? rej(err) : res(row)))))
                .then(results => {
                    resolve({
                        total: results[0].total,
                        running: results[1].running,
                        completed: results[2].completed,
                        errors: results[3].errors,
                        avgCompletionTime: results[4].avgTime || 0,
                        dailyUsage: results[5],
                        hourlyUsage: results[6]
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

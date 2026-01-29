-- Agents Table
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    label TEXT,
    model TEXT NOT NULL,
    task TEXT,
    status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'error')),
    progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
    startTime INTEGER,
    endTime INTEGER,
    tokensIn INTEGER DEFAULT 0,
    tokensOut INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

-- Logs Table
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agentId TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    level TEXT NOT NULL CHECK(level IN ('info', 'warning', 'error', 'debug')),
    FOREIGN KEY (agentId) REFERENCES agents(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_createdAt ON agents(createdAt);
CREATE INDEX IF NOT EXISTS idx_logs_agentId ON logs(agentId);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);

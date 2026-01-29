const WebSocket = require('ws');

let wss = null;

function initializeWebSocket(server) {
    wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
        console.log('New WebSocket client connected');

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                console.log('Received message:', data);
                
                // Handle ping/pong
                if (data.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        });

        ws.on('close', () => {
            console.log('WebSocket client disconnected');
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });

        // Send initial connection confirmation
        ws.send(JSON.stringify({ 
            type: 'connection', 
            status: 'connected',
            timestamp: Date.now()
        }));
    });

    // Return object with broadcastEvent method
    return {
        wss,
        broadcastEvent: (eventType, data) => broadcastEvent(eventType, data)
    };
}

function broadcastEvent(eventType, data) {
    if (!wss) {
        console.warn('WebSocket server not initialized');
        return;
    }

    const message = JSON.stringify({
        type: eventType,
        data,
        timestamp: Date.now()
    });

    let sentCount = 0;
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
            sentCount++;
        }
    });

    console.log(`Broadcast ${eventType} to ${sentCount} clients`);
}

function getConnectionCount() {
    if (!wss) return 0;
    return Array.from(wss.clients).filter(client => client.readyState === WebSocket.OPEN).length;
}

module.exports = {
    initializeWebSocket,
    broadcastEvent,
    getConnectionCount,
    getWebSocketServer: () => wss
};

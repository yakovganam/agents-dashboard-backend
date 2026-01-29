const clawdbotBridge = require('./clawdbot/bridge');

async function testBridge() {
    console.log('--- Testing Clawdbot Bridge ---');
    try {
        await clawdbotBridge.initialize();
        console.log('Initialization: SUCCESS');
        
        const sessions = await clawdbotBridge.getAllSessions();
        console.log(`Found ${sessions.length} sessions`);
        
        if (sessions.length > 0) {
            console.log('First session sample:', JSON.stringify(sessions[0], null, 2));
        } else {
            console.log('No sessions found. Is sessions.json empty or missing?');
        }

        const stats = await clawdbotBridge.getStatistics();
        console.log('Statistics:', JSON.stringify(stats, null, 2));

    } catch (error) {
        console.error('Test Failed:', error.message);
    }
}

testBridge();

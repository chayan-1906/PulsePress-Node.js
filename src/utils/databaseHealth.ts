import mongoose from 'mongoose';
import {IDatabaseHealth} from "../types/health-check";

function getDatabaseHealth(): IDatabaseHealth {
    const readyStates = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting',
    };

    const health: IDatabaseHealth = {
        connected: mongoose.connection.readyState === 1,
        readyState: readyStates[mongoose.connection.readyState as keyof typeof readyStates] || 'unknown',
    };

    if (mongoose.connection.readyState === 1) {
        health.host = mongoose.connection.host;
        health.name = mongoose.connection.name;
        // @ts-ignore - accessing internal property for monitoring
        health.connectionCount = mongoose.connection.db?.serverConfig?.s?.pool?.totalConnectionCount || 0;
    }

    return health;
}

export {getDatabaseHealth};

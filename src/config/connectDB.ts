import mongoose from "mongoose";
import {MONGO_URI} from "./config";

let cachedConnection: typeof mongoose | null = null;

async function connectDB() {
    try {
        if (cachedConnection && mongoose.connection.readyState === 1) {
            console.log('Database: Using cached connection'.cyan, {cached: true});
            return cachedConnection;
        }

        const options = {
            maxPoolSize: 10,          // Limit concurrent connections
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxIdleTimeMS: 30000,     // Close idle connections
            retryWrites: true,
        };

        const connection = await mongoose.connect(MONGO_URI!, options);

        cachedConnection = connection;
        console.log('SUCCESS: Database connection established'.bgGreen.bold, {host: mongoose.connection.host, pooling: true});

        mongoose.connection.on('connected', () => {
            console.log('Background: Mongoose connected to MongoDB'.blue);
        });

        mongoose.connection.on('error', (err) => {
            console.error('Service Error: Mongoose connection failed'.red.bold, err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('Config Warning: Mongoose disconnected'.yellow.italic);
            cachedConnection = null;
        });

        process.on('SIGINT', async () => {
            await closeConnection();
            console.log('Background: MongoDB connection closed through app termination (SIGINT)'.blue);
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            await closeConnection();
            console.log('Background: MongoDB connection closed through app termination (SIGTERM)'.blue);
            process.exit(0);
        });

        return connection;
    } catch (error) {
        console.error('Service Error: Database connection failed'.red.bold, error);
        cachedConnection = null;
        throw error;
    }
}

async function closeConnection() {
    if (cachedConnection) {
        try {
            await mongoose.connection.close();
            cachedConnection = null;
            console.log('SUCCESS: MongoDB connection closed gracefully'.bgGreen.bold);
        } catch (error) {
            console.error('Service Error: Failed to close MongoDB connection'.red.bold, error);
        }
    }
}

export {connectDB, closeConnection};

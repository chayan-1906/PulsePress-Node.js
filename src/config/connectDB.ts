import mongoose from "mongoose";
import {MONGO_URI} from "./config";

let cachedConnection: typeof mongoose | null = null;

async function connectDB() {
    try {
        if (cachedConnection && mongoose.connection.readyState === 1) {
            console.log('Using cached database connection'.bgCyan.black.bold);
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
        console.log(`New database connection established with pooling to ${mongoose.connection.host}`.bgYellow.black.bold);

        mongoose.connection.on('connected', () => {
            console.log('Mongoose connected to MongoDB'.green.bold);
        });

        mongoose.connection.on('error', (err) => {
            console.log('Mongoose connection error:'.red.bold, err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('Mongoose disconnected'.yellow.bold);
            cachedConnection = null;
        });

        process.on('SIGINT', async () => {
            await closeConnection();
            console.log('MongoDB connection closed through app termination (SIGINT)'.cyan.bold);
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            await closeConnection();
            console.log('MongoDB connection closed through app termination (SIGTERM)'.cyan.bold);
            process.exit(0);
        });

        return connection;
    } catch (error) {
        console.error('ERROR: inside catch of connectDB:'.red.bold, error);
        cachedConnection = null;
        throw error;
    }
}

async function closeConnection() {
    if (cachedConnection) {
        try {
            await mongoose.connection.close();
            cachedConnection = null;
            console.log('MongoDB connection closed gracefully'.green.bold);
        } catch (error) {
            console.log('Error closing MongoDB connection:'.red.bold, error);
        }
    }
}

export {connectDB, closeConnection};

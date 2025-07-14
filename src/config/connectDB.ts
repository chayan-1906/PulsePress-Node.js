import mongoose from "mongoose";
import {MONGO_URI} from "./config";

async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI!);
        console.log(`Connected to database ${mongoose.connection.host}`.bgYellow.black.bold);
    } catch (error) {
        console.log('inside catch of connectDB:'.red.bold, error);
    }
}

export {connectDB};

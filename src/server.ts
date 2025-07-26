import 'colors';
import cors from 'cors';
import morgan from "morgan";
import express from 'express';
import {PORT} from "./config/config";
import aiRoutes from "./routes/AIRoutes";
import getLocalIp from "./utils/getLocalIP";
import {connectDB} from "./config/connectDB";
import newsRoutes from "./routes/NewsRoutes";
import authRoutes from "./routes/AuthRoutes";
import bookmarkRoutes from "./routes/BookmarkRoutes";
import readingHistoryRoutes from "./routes/ReadingHistoryRoutes";
import userPreferenceRoutes from "./routes/UserPreferenceRoutes";
import contentRecommendationRoutes from "./routes/ContentRecommendationRoutes";

// rest object
const app = express();

// middlewares
app.use(cors({
    origin: [
        'http://localhost:3000',                // Development
        'https://pulsepress.vercel.app',        // Production web - yet to be decided
        'exp://192.168.1.100:8081',             // Expo development
    ],
    credentials: true,                          // Allow cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());
app.use(morgan('dev'));

// routes
app.use('/api/v1/news', newsRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/bookmark', bookmarkRoutes);
app.use('/api/v1/reading-history', readingHistoryRoutes);
app.use('/api/v1/preferences', userPreferenceRoutes);
app.use('/api/v1/recommendation', contentRecommendationRoutes);

app.get('/', function (req, res) {
    return res.status(200).send('<h1>Welcome to PulsePress Server</h1>');
});

const port = Number(PORT) || 4000;

const start = async () => {
    try {
        await connectDB();
        app.listen(port, '0.0.0.0', (error?: Error, address?: string) => {
            if (error) {
                console.log('Error in starting server'.red.bold, error.message);
            } else {
                console.log(`Server started on ${PORT}`.blue.italic.bold);
                console.log(`\t- Local:        http://localhost:${PORT}`.blue.bold);
                console.log(`\t- Network:      http://${getLocalIp()}:${PORT}`.blue.bold);
            }
        });
    } catch (error: any) {
        console.log(`Error during server setup:`.red.bold, error);
    }
}

start();

import 'colors';
import cors from 'cors';
import morgan from "morgan";
import express from 'express';
import {PORT} from "./config/config";
import getLocalIp from "./utils/getLocalIP";
import {connectDB} from "./config/connectDB";

// rest object
const app = express();

// middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

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

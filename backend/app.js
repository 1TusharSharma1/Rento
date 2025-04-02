import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from './config/passport.js';
import authRoutes from './routes/auth.routes.js';
import vehicleRoutes from './routes/vehicle.routes.js';
import biddingRoutes from './routes/bidding.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import messagingRoutes from './routes/messaging.routes.js';
import adminRoutes from './routes/admin.routes.js';
import statsRoutes from './stats/statsRoutes.js';
import ApiError from './utils/ApiError.js';
import dotenv from 'dotenv';
import {createServer} from 'node:http';
import chatSocket from './socket/chatSocket.js';
import awsSQSConsumer from './utils/SQSconsumer.js';
dotenv.config(); 

const app = express();
const server = createServer(app);
// Initialize chat socket with the HTTP server
chatSocket(server);

// Enhanced CORS configuration for credential support
const corsOptions = {
    origin: function(origin, callback) {
        // Allow requests from localhost on any port and from your production domain
        const allowedOrigins = [
            'http://localhost:5502',
            'http://127.0.0.1:5502',
            'http://localhost:3000',
            'http://localhost:8080',
            'http://localhost:5173',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:8080',
            'http://127.0.0.1:5173'
        ];
        
        // Allow requests with no origin (like mobile apps, curl, postman)
        if (!origin || allowedOrigins.some(allowed => origin.startsWith(allowed))) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST','PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Apply CORS middleware with custom options
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Parse JSON request bodies with 5MB size limit
app.use(express.json({
    limit: '16kb'
}));

// Parse URL-encoded request bodies with extended mode and 5MB size limit
app.use(express.urlencoded({
    extended: true,
    limit: '16kb' 
}));

// Serve static files from 'public' directory
app.use(express.static('public'));  

// Parse cookies in requests
app.use(cookieParser());

// Initialize Passport authentication
app.use(passport.initialize());

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/vehicles', vehicleRoutes);
app.use('/api/v1/bids', biddingRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/messaging', messagingRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/stats', statsRoutes);

// Run AWS SQS consumer every 10 seconds to process queued messages
setInterval(awsSQSConsumer, 10000);

// Global error handler middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    // Handle custom API errors
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        errors: err.errors
      });
    }
    
    // Handle all other errors as internal server errors
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      errors: process.env.NODE_ENV === 'development' ? [err.message] : []
    });
  });

export default server;

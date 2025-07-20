import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { DatabaseService } from './database/DatabaseService';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import buddyRoutes from './routes/buddyRoutes';
import messageRoutes from './routes/messageRoutes';
import { socketAuthMiddleware, AuthenticatedSocket } from './middleware/socketAuthMiddleware';
import { ConnectionManager } from './services/ConnectionManager';
import { SocketEventHandlers } from './services/SocketEventHandlers';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Initialize database service
const dbService = DatabaseService.getInstance();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/buddies', buddyRoutes);
app.use('/api/messages', messageRoutes);

// Simple health check route (for Railway deployment)
app.get('/health', (req: any, res: any) => {
  res.json({
    status: 'OK',
    message: 'AIM Backend Server is running',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Detailed health check route with database status
app.get('/health/detailed', async (req: any, res: any) => {
  try {
    const dbHealth = await dbService.healthCheck();
    res.json({
      status: 'OK',
      message: 'AIM Backend Server is running',
      database: dbHealth,
      timestamp: new Date().toISOString(),
      port: PORT
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Server health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Database health endpoint
app.get('/health/database', async (req: any, res: any) => {
  try {
    const dbHealth = await dbService.healthCheck();
    res.json(dbHealth);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown database error'
    });
  }
});

// Socket.io middleware and connection handling
io.use(socketAuthMiddleware);

// Initialize connection manager and event handlers
let connectionManager: ConnectionManager;
let eventHandlers: SocketEventHandlers;

io.on('connection', (socket) => {
  const authSocket = socket as AuthenticatedSocket;
  console.log(`Authenticated user ${authSocket.user.screenName} connected with socket ${authSocket.id}`);
  
  // Setup event handlers for this socket
  eventHandlers.setupEventHandlers(authSocket);
});

// Initialize server
async function startServer() {
  try {
    // Initialize database
    await dbService.initialize();
    console.log('Database initialized successfully');

    // Initialize WebSocket services
    connectionManager = ConnectionManager.getInstance(io);
    eventHandlers = new SocketEventHandlers(io);
    console.log('WebSocket services initialized');

    // Start server (bind to 0.0.0.0 for Railway/Render deployment)
    server.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`AIM Backend server running on port ${PORT}`);
      console.log(`WebSocket server ready for connections`);
      console.log(`Health check available at: http://0.0.0.0:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await dbService.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  await dbService.close();
  process.exit(0);
});

startServer();

export { app, io, dbService, connectionManager, eventHandlers };
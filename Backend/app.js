/**
 * Main Application Entry Point with Microservice Architecture
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Database from './config/database.js';
import schemas from './schemas/index.js';
import serviceRoutes from './services/index.js';
import EmbeddingMigration from './services/chatbot-service/scripts/migrateChatbotEmbeddings.js';
import { initPaymentServices, stopPaymentServices } from './services/payment-service/init.js';
import { initPackageExpiryCron } from './services/packageExpiryService.js';
import notificationWSServer from './services/notification-service/websocket/notificationWebSocket.js';
import { createServer } from 'http';


// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Make schemas available globally
app.locals.schemas = schemas;

// Microservice routes
app.use('/', serviceRoutes);

// Health check route
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: Database.isConnected() ? 'Connected' : 'Disconnected',
        environment: process.env.NODE_ENV || 'development'
    });
});

// API status route
app.get('/api/status', async (req, res) => {
    try {
        const dbStatus = Database.getConnectionStatus();
        
        // Get collection statistics
        const collections = [];
        if (Database.isConnected()) {
            const modelNames = Object.keys(schemas);
            
            for (const modelName of modelNames) {
                try {
                    const Model = schemas[modelName];
                    const count = await Model.countDocuments();
                    collections.push({
                        name: Model.collection.name,
                        model: modelName,
                        documentCount: count
                    });
                } catch (error) {
                    collections.push({
                        name: modelName,
                        error: error.message
                    });
                }
            }
        }

        res.json({
            status: 'success',
            api: {
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                uptime: process.uptime()
            },
            database: {
                status: dbStatus,
                connected: Database.isConnected(),
                collections: collections
            },
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                memory: process.memoryUsage(),
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Database info route
app.get('/api/database/info', async (req, res) => {
    try {
        if (!Database.isConnected()) {
            return res.status(503).json({
                status: 'error',
                message: 'Database not connected'
            });
        }

        const db = Database.connection.db;
        const admin = db.admin();
        
        // Get database stats
        const stats = await db.stats();
        const serverStatus = await admin.serverStatus();
        
        // Get collections info
        const collections = await db.listCollections().toArray();
        const collectionDetails = [];
        
        for (const collection of collections) {
            try {
                const collStats = await db.collection(collection.name).stats();
                collectionDetails.push({
                    name: collection.name,
                    documents: collStats.count,
                    size: collStats.size,
                    indexes: collStats.nindexes,
                    avgObjSize: collStats.avgObjSize
                });
            } catch (error) {
                collectionDetails.push({
                    name: collection.name,
                    error: error.message
                });
            }
        }

        res.json({
            status: 'success',
            database: {
                name: stats.db,
                collections: stats.collections,
                documents: stats.objects,
                dataSize: stats.dataSize,
                storageSize: stats.storageSize,
                indexes: stats.indexes,
                indexSize: stats.indexSize
            },
            server: {
                version: serverStatus.version,
                uptime: serverStatus.uptime,
                connections: serverStatus.connections
            },
            collections: collectionDetails
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    
    res.status(error.status || 500).json({
        status: 'error',
        message: error.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found',
        path: req.originalUrl
    });
});

// Start server
async function startServer() {
    try {
        // Connect to database
        await Database.connect();
        
        // Run chatbot migration
        console.log('\nRunning chatbot migration...');
        try {
            const migration = new EmbeddingMigration();
            const migrationSuccess = await migration.runMigration();
            if (migrationSuccess) {
                console.log('Chatbot migration completed successfully');
            } else {
                console.log('Chatbot migration had issues, but continuing...');
            }
        } catch (migrationError) {
            console.error('Migration error:', migrationError.message);
            console.log('Continuing without migration...');
        }
        
        // Initialize Payment Services
        console.log('\nInitializing payment services...');
        initPaymentServices();

        // Initialize Package Expiry Cron Jobs
        console.log('\nInitializing package expiry cron jobs...');
        initPackageExpiryCron();

        // Create HTTP server
        const server = createServer(app);
        
        // Initialize WebSocket server
        console.log('\nInitializing WebSocket notification server...');
        notificationWSServer.initialize(server);
        
        // Start server
        server.listen(PORT, () => {
            console.log(`\n🚀 Server running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`📋 API status: http://localhost:${PORT}/api/status`);
            console.log(`🗄️  Database info: http://localhost:${PORT}/api/database/info`);
            console.log(`📚 API documentation: http://localhost:${PORT}/api`);
            console.log(`🔔 WebSocket notifications: ws://localhost:${PORT}/notifications`);
            console.log(`\n🔗 API Endpoints:`);
            console.log(`   👤 Users: http://localhost:${PORT}/api/users`);
            console.log(`   🏠 Properties: http://localhost:${PORT}/api/properties`);
            console.log(`   🚪 Rooms: http://localhost:${PORT}/api/rooms`);
            console.log(`   🔔 Notifications: http://localhost:${PORT}/api/notifications`);
            console.log(`\n💡 Ready to handle requests!`);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    stopPaymentServices();
    notificationWSServer.close();
    await Database.disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    stopPaymentServices();
    notificationWSServer.close();
    await Database.disconnect();
    process.exit(0);
});

// Start the server
startServer();

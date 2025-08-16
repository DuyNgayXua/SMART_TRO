/**
 * Database Configuration
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

class Database {
    constructor() {
        this.connection = null;
    }

    async connect() {
        try {
            const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/SMARTTRO';
            
            const options = {
                maxPoolSize: 10, // Maintain up to 10 socket connections
                serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
                socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
                bufferCommands: false // Disable mongoose buffering
            };

            this.connection = await mongoose.connect(mongoURI, options);
            
            console.log('✅ Connected to MongoDB Atlas successfully!');
            console.log(`Database: ${this.connection.connection.name}`);
            console.log(`Host: ${this.connection.connection.host}`);
            
            // Handle connection events
            mongoose.connection.on('error', (err) => {
                console.error('❌ MongoDB connection error:', err);
            });

            mongoose.connection.on('disconnected', () => {
                console.log('⚠️ MongoDB disconnected');
            });

            mongoose.connection.on('reconnected', () => {
                console.log('✅ MongoDB reconnected');
            });

            // Graceful shutdown
            process.on('SIGINT', async () => {
                await this.disconnect();
                process.exit(0);
            });

            return this.connection;
        } catch (error) {
            console.error('❌ Failed to connect to MongoDB:', error);
            throw error;
        }
    }

    async disconnect() {
        try {
            await mongoose.connection.close();
            console.log('✅ Disconnected from MongoDB');
        } catch (error) {
            console.error('❌ Error disconnecting from MongoDB:', error);
        }
    }

    // Get connection status
    getConnectionStatus() {
        const states = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        return states[mongoose.connection.readyState] || 'unknown';
    }

    // Check if connected
    isConnected() {
        return mongoose.connection.readyState === 1;
    }
}

export default new Database();

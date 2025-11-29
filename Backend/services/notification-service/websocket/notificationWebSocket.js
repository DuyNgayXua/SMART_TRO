import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { User } from '../../../schemas/index.js';

class NotificationWebSocketServer {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map userId -> WebSocket connection
  }

  initialize(server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/notifications'
    });

    this.wss.on('connection', async (ws, req) => {
      try {
        // Extract userId from query parameters
        const url = new URL(req.url, `http://${req.headers.host}`);
        const userId = url.searchParams.get('userId');
        
        if (!userId) {
          console.log('WebSocket connection rejected: No userId provided');
          ws.close(1008, 'No userId provided');
          return;
        }

        // Store the connection
        this.clients.set(userId, ws);
        console.log(`[${new Date().toISOString()}] WebSocket connected for user: ${userId}`);
        console.log(`Total connected clients: ${this.clients.size}`);
        console.log(`All connected users:`, Array.from(this.clients.keys()));
        
        // Send connection confirmation
        ws.send(JSON.stringify({
          type: 'connection',
          message: 'Connected to notification service',
          timestamp: new Date().toISOString()
        }));

        // Handle connection close
        ws.on('close', () => {
          console.log(`[${new Date().toISOString()}] WebSocket disconnected for user: ${userId}`);
          this.clients.delete(userId);
          console.log(`Remaining connected clients: ${this.clients.size}`);
        });

        // Handle connection errors
        ws.on('error', (error) => {
          console.error(`WebSocket error for user ${userId}:`, error);
          this.clients.delete(userId);
        });

        // Ping/pong for connection health
        ws.on('pong', () => {
          ws.isAlive = true;
        });

      } catch (error) {
        console.error('WebSocket connection error:', error);
        ws.close(1011, 'Server error');
      }
    });

    // Health check interval
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // Check every 30 seconds

    console.log('Notification WebSocket server initialized');
  }

  // Send notification to specific user
  sendNotificationToUser(userId, notification) {
    try {
      // Extract string ID if userId is an object
      const userIdString = (userId && userId._id) ? userId._id.toString() : userId.toString();
      
      console.log(`[${new Date().toISOString()}] Attempting to send notification to user ${userIdString}`);
      console.log(`Notification data:`, notification);
      console.log(`Connected clients:`, Array.from(this.clients.keys()));
      
      const ws = this.clients.get(userIdString);
      
      if (ws && ws.readyState === ws.OPEN) {
        const message = {
          type: 'notification',
          ...notification,
          timestamp: new Date().toISOString()
        };
        
        console.log(`Sending message to user ${userIdString}:`, message);
        ws.send(JSON.stringify(message));
        console.log(`Notification sent successfully to user ${userIdString}:`, notification.title);
        return true;
      } else {
        if (!ws) {
          console.log(`User ${userIdString} not found in connected clients`);
        } else {
          console.log(`User ${userIdString} WebSocket not open. ReadyState:`, ws.readyState);
          console.log(`ReadyState meanings: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED`);
        }
        return false;
      }
    } catch (error) {
      console.error(`Error sending notification to user ${userId}:`, error);
      return false;
    }
  }

  // Send notification to multiple users
  sendNotificationToUsers(userIds, notification) {
    const results = [];
    
    userIds.forEach(userId => {
      const sent = this.sendNotificationToUser(userId, notification);
      results.push({ userId, sent });
    });
    
    return results;
  }

  // Broadcast to all connected users
  broadcast(notification) {
    const message = {
      type: 'broadcast',
      ...notification,
      timestamp: new Date().toISOString()
    };

    this.wss.clients.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
    
    console.log('Notification broadcasted to all users:', notification.title);
  }

  // Get connection statistics
  getStats() {
    return {
      totalConnections: this.clients.size,
      connectedUsers: Array.from(this.clients.keys()),
      serverStatus: this.wss ? 'running' : 'stopped'
    };
  }

  // Close all connections
  close() {
    if (this.wss) {
      this.wss.clients.forEach(ws => {
        ws.close(1001, 'Server shutting down');
      });
      this.wss.close();
      console.log('Notification WebSocket server closed');
    }
    this.clients.clear();
  }
}

// Create singleton instance
const notificationWSServer = new NotificationWebSocketServer();

export default notificationWSServer;

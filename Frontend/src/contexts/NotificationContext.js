import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import notificationAPI from '../services/notificationAPI';
import { toast } from 'react-toastify';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [wsConnection, setWsConnection] = useState(null);
  const { user } = useAuth();
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isConnectingRef = useRef(false);

  // Persist unreadCount to localStorage
  useEffect(() => {
    if (user?._id) {
      const key = `unreadCount_${user._id}`;
      localStorage.setItem(key, unreadCount.toString());
      // console.log('Saved unreadCount to localStorage:', unreadCount);
    }
  }, [unreadCount, user?._id]);

  // Restore unreadCount from localStorage on mount
  useEffect(() => {
    if (user?._id) {
      const key = `unreadCount_${user._id}`;
      const saved = localStorage.getItem(key);
      if (saved && saved !== '0') {
        const savedCount = parseInt(saved, 10);
        // console.log(' Restored unreadCount from localStorage:', savedCount);
        setUnreadCount(savedCount);
      }
    }
  }, [user?._id]);

  // Restore notifications from localStorage on mount
  useEffect(() => {
    if (user?._id) {
      const key = `notifications_${user._id}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const savedNotifications = JSON.parse(saved);
          if (Array.isArray(savedNotifications) && savedNotifications.length > 0) {
            // console.log('Restored notifications from localStorage:', savedNotifications.length);
            setNotifications(savedNotifications);
          }
        } catch (error) {
          console.error('Error parsing saved notifications:', error);
          localStorage.removeItem(key);
        }
      }
    }
  }, [user?._id]);

useEffect(() => {
  const syncUnreadCount = (e) => {
    if (e.key === `unreadCount_${user?._id}` && e.newValue) {
      const newCount = parseInt(e.newValue, 10);
      setUnreadCount(newCount);
    }
  };

  const syncNotifications = (e) => {
    if (e.key === `notifications_${user?._id}` && e.newValue) {
      try {
        const newNotifications = JSON.parse(e.newValue);
        if (Array.isArray(newNotifications)) {
          // console.log('Syncing notifications from localStorage:', newNotifications.length);
          setNotifications(newNotifications);
          
          // Broadcast custom event for other components
          const notificationsChangedEvent = new CustomEvent('notificationsChanged', {
            detail: { notifications: newNotifications }
          });
          window.dispatchEvent(notificationsChangedEvent);
        }
      } catch (error) {
        console.error('Error parsing notifications from localStorage:', error);
      }
    }
  };

  window.addEventListener('storage', syncUnreadCount);
  window.addEventListener('storage', syncNotifications);
  
  return () => {
    window.removeEventListener('storage', syncUnreadCount);
    window.removeEventListener('storage', syncNotifications);
  };
}, [user?._id]);

  // Load notifications from API
  const loadNotifications = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      // Get all notifications without pagination
      const response = await notificationAPI.getAllNotifications();
      // console.log('Loaded all notifications:', response);
      if (response.success) {
        setNotifications(response.data.notifications || []);
        setUnreadCount(response.data.unreadCount || 0);
        
        // Also sync to localStorage
        const key = `notifications_${user._id}`;
        localStorage.setItem(key, JSON.stringify(response.data.notifications || []));
        // console.log('Saved all notifications to localStorage');
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      // Don't show error toast for failed notification loads
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Check backend health before connecting WebSocket
  const checkBackendHealth = useCallback(async () => {
    try {
      const backendUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        console.log('Backend health check passed');
        return true;
      } else {
        console.warn('Backend health check failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Backend health check error:', error.message);
      return false;
    }
  }, []);

  // WebSocket connection setup - remove user dependency to prevent reconnections
  const connectWebSocket = useCallback(async () => {
    if (!user?._id || isConnectingRef.current || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
      return;
    }

    // Check backend health first
    const isBackendHealthy = await checkBackendHealth();
    if (!isBackendHealthy) {
      console.warn('Backend is not healthy, skipping WebSocket connection');
      return;
    }

    try {
      isConnectingRef.current = true;
      
      // Check if backend is running first
      const backendUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';
      const wsUrl = `${backendUrl.replace('http', 'ws')}/notifications?userId=${user._id}`;
      
      // console.log('Attempting WebSocket connection to:', wsUrl);
    
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.warn('WebSocket connection timeout');
          ws.close();
          isConnectingRef.current = false;
        }
      }, 10000); // 10 second timeout

      ws.onopen = () => {
        // console.log('WebSocket connected for notifications at', new Date().toISOString());
        // console.log('Connected user:', user._id);
        clearTimeout(connectionTimeout);
        setWsConnection(ws);
        isConnectingRef.current = false;

        // Clear any pending reconnection attempts
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = async (event) => {
        try {
        
          const data = JSON.parse(event.data);
          // console.log('Parsed data:', data);

          // Filter out connection messages and only process actual notifications
          if (data.type === 'connection') {
            console.log('ℹConnection message received, ignoring');
            return;
          }

          // Check if this is a real notification (has required fields)
          if (data._id && data.title && data.content) {
            // console.log('Notification message received at', new Date().toISOString(), ':', data);

            // Extract notification data
            const notification = {
              _id: data._id,
              title: data.title,
              content: data.content,
              type: data.type, // This is the actual notification type (property, report, etc)
              isRead: data.isRead || false,
              createdAt: data.createdAt || data.timestamp,
              relatedId: data.relatedId,
              metadata: data.metadata
            };

            // console.log('Processed notification at', new Date().toISOString(), ':', notification);

            // Add new notification to the list
            setNotifications(prev => {
              // console.log('Adding notification to list at', new Date().toISOString(), '. Current count:', prev.length);
              const newList = [notification, ...prev];
              // console.log('New notifications list length:', newList.length);
              return newList;
            });

            setUnreadCount(prev => {
              const newCount = prev + 1;
              // console.log('Incrementing unread count at', new Date().toISOString(), 'from', prev, 'to', newCount);
              return newCount;
            });

            // Broadcast property status change event if it's a property notification
            if (notification.type === 'property' && notification.relatedId) {
              const propertyUpdateEvent = new CustomEvent('propertyStatusChanged', {
                detail: {
                  propertyId: notification.relatedId,
                  notification: notification
                }
              });
              window.dispatchEvent(propertyUpdateEvent);
              // console.log('Broadcasted property status change event for:', notification.relatedId);
            }

            // Show toast notification
            toast.info(notification.title, {
              position: "top-center",
              autoClose: 4000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
            });
          } else {
            console.log('Invalid notification format at', new Date().toISOString(), '. Missing required fields (_id, title, content):', data);
          }
        } catch (error) {
          console.error('Error parsing notification at', new Date().toISOString(), ':', error);
          console.error('Raw data:', event.data);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        console.error('WebSocket URL:', wsUrl);
        console.error('WebSocket readyState:', ws.readyState);
        isConnectingRef.current = false;
        
        // Show user-friendly error message
        if (error.type === 'error') {
          console.warn('WebSocket connection failed. Notifications will work but real-time updates may be limited.');
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected at', new Date().toISOString());
        console.log('Close code:', event.code, 'Reason:', event.reason);
        setWsConnection(null);
        wsRef.current = null;
        isConnectingRef.current = false;
        clearTimeout(connectionTimeout);

        // Only attempt to reconnect if it wasn't a manual close and user is still logged in
        // And if it's not a connection refused error (code 1006)
        if (event.code !== 1000 && event.code !== 1006 && user && !reconnectTimeoutRef.current) {
          console.log('Will attempt to reconnect in 5 seconds...');
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...');
            reconnectTimeoutRef.current = null;
            connectWebSocket();
          }, 5000); // Increased to 5 seconds
        } else if (event.code === 1006) {
          console.warn('WebSocket connection refused. Backend may not be running.');
        }
      };

    } catch (error) {
      console.error(' Error creating WebSocket connection:', error);
      isConnectingRef.current = false;
      
      // Try to reconnect after a longer delay if there's an error creating the connection
      if (user && !reconnectTimeoutRef.current) {
        console.log('Will retry WebSocket connection in 10 seconds...');
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connectWebSocket();
        }, 10000);
      }
    }
  }, [user?._id]); // Only depend on user ID, not entire user object

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    // console.log('Disconnecting WebSocket...');

    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    setWsConnection(null);
    isConnectingRef.current = false;
  }, []);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const response = await notificationAPI.markAsRead(notificationId);
      if (response.success) {
        setNotifications(prev => {
          const updated = prev.map(notif =>
            notif._id === notificationId
              ? { ...notif, isRead: true }
              : notif
          );
          
          // Update localStorage
          if (user?._id) {
            const key = `notifications_${user._id}`;
            localStorage.setItem(key, JSON.stringify(updated));
          }
          
          return updated;
        });
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const response = await notificationAPI.markAllAsRead();
      if (response.success) {
        setNotifications(prev => {
          const updated = prev.map(notif => ({ ...notif, isRead: true }));
          
          // Update localStorage
          if (user?._id) {
            const key = `notifications_${user._id}`;
            localStorage.setItem(key, JSON.stringify(updated));
          }
          
          return updated;
        });
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      // console.log('Deleting notification:', notificationId);
      
      // Find notification first to check if it's unread
      const notificationToDelete = notifications.find(n => n._id === notificationId);
      
      const response = await notificationAPI.deleteNotification(notificationId);
      
      if (response.success) {
        // console.log('Notification deleted successfully on server');
        
        // Remove from local state
        setNotifications(prev => {
          const filtered = prev.filter(notif => notif._id !== notificationId);
          // console.log('Local notifications updated. Count:', filtered.length);
          
          // Also update localStorage
          const key = `notifications_${user._id}`;
          localStorage.setItem(key, JSON.stringify(filtered));
          // console.log('Updated notifications in localStorage');
          
          return filtered;
        });
        
        // Update unread count if the deleted notification was unread
        if (notificationToDelete && !notificationToDelete.isRead) {
          setUnreadCount(prev => {
            const newCount = Math.max(0, prev - 1);
            // console.log('Unread count updated:', prev, '->', newCount);
            return newCount;
          });
        }
        
        // console.log('Notification delete completed successfully');
        return { success: true };
      } else {
        throw new Error(response.message || 'Failed to delete notification');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  };

  // Effect to manage WebSocket connection based on user login status
  useEffect(() => {
    if (user && user._id) {
      // console.log('User logged in, initializing notifications for:', user._id);
      // console.log('Current WebSocket state:', wsRef.current?.readyState);

      // Only load notifications if we don't have any yet
      if (notifications.length === 0) {
        console.log('Loading initial notifications...');
        loadNotifications();
      }

      // Only connect WebSocket if not already connected
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.log('WebSocket not connected, connecting in 500ms...');
        const connectTimer = setTimeout(() => {
          connectWebSocket();
        }, 500);
        return () => {
          console.log('Clearing connect timer');
          clearTimeout(connectTimer);
        };
      } else {
        console.log('WebSocket already connected, skipping');
      }
    } else {
      console.log('No user, cleaning up WebSocket and localStorage');
      disconnectWebSocket();
      setNotifications([]);
      setUnreadCount(0);
      
      // Clean up localStorage when user logs out
      if (user === null) { // Explicitly check for logout
        // console.log('Cleaning up notifications localStorage');
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('notifications_') || key.startsWith('unreadCount_')) {
            localStorage.removeItem(key);
          }
        });
      }
    }
  }, [user?._id, loadNotifications, connectWebSocket, disconnectWebSocket]); // Add missing dependencies

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('NotificationProvider unmounting, cleaning up...');
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);


  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('NotificationProvider unmounting, cleaning up...');
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    notifications,
    unreadCount,
    loading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    wsConnection: !!wsConnection,
    // Debug methods
    reconnectWebSocket: () => {
      console.log('Manual WebSocket reconnect requested');
      disconnectWebSocket();
      setTimeout(() => {
        connectWebSocket();
      }, 1000);
    },
    refreshNotifications: () => {
      console.log('Manual notification refresh requested');
      loadNotifications();
    }

  }), [
    notifications,
    unreadCount,
    loading,
    wsConnection,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
    // Remove connectWebSocket and disconnectWebSocket from dependencies to avoid circular deps
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;

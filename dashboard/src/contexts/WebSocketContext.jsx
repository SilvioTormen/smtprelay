import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext-Debug'; // Use debug version

const WebSocketContext = createContext(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState(null);
  const [devices, setDevices] = useState([]);
  const [queueStatus, setQueueStatus] = useState(null);
  const { user } = useAuth();

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  useEffect(() => {
    if (!user) {
      // Disconnect if no user
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Connect with cookies - NO TOKEN in auth!
    const newSocket = io(API_URL, {
      withCredentials: true, // CRITICAL: Send cookies with WebSocket
      transports: ['websocket', 'polling']
      // Remove auth.token - we use cookies now!
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      
      // Request initial data
      newSocket.emit('request:stats');
      newSocket.emit('request:devices');
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error.message);
      setConnected(false);
    });

    // Listen for updates
    newSocket.on('stats:update', (data) => {
      setStats(data);
    });

    newSocket.on('devices:update', (data) => {
      setDevices(data);
    });

    newSocket.on('queue:update', (data) => {
      setQueueStatus(data);
    });

    newSocket.on('email:sent', (data) => {
      console.log('Email sent:', data);
      // Could trigger a notification here
    });

    newSocket.on('email:failed', (data) => {
      console.error('Email failed:', data);
      // Could trigger an error notification
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, [user, API_URL]);

  // Request fresh stats
  const requestStats = () => {
    if (socket && connected) {
      socket.emit('request:stats');
    }
  };

  // Request device list
  const requestDevices = () => {
    if (socket && connected) {
      socket.emit('request:devices');
    }
  };

  // Request queue status
  const requestQueueStatus = () => {
    if (socket && connected) {
      socket.emit('request:queue');
    }
  };

  // Send a command
  const sendCommand = (command, data) => {
    if (socket && connected) {
      socket.emit(command, data);
    }
  };

  const value = {
    socket,
    connected,
    stats,
    devices,
    queueStatus,
    requestStats,
    requestDevices,
    requestQueueStatus,
    sendCommand
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
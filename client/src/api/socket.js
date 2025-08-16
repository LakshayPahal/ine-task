import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_API_WS || 'http://localhost:3000', {
  transports: ['websocket', 'polling'],
  timeout: 20000,
  forceNew: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  maxReconnectionAttempts: 10
});

socket.on('connect', () => {
  console.log('Connected to WebSocket server:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected from WebSocket server:', reason);
});

socket.on('connect_error', (error) => {
  console.error('WebSocket connection error:', error);
});

socket.on('reconnect', (attemptNumber) => {
  console.log(`Reconnected to WebSocket server (attempt ${attemptNumber})`);
});

socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});

export default socket;
function initSockets(io) {
  const connectedUsers = new Map();
  
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('joinAuction', ({ auctionId, userId }) => {
      if (!auctionId) {
        socket.emit('error', { message: 'auctionId is required' });
        return;
      }

      socket.join(`auction:${auctionId}`);
      
      socket.data.userId = userId;
      
      if (!connectedUsers.has(socket.id)) {
        connectedUsers.set(socket.id, { userId, auctionIds: new Set() });
      }
      connectedUsers.get(socket.id).auctionIds.add(auctionId);

      console.log(`User ${userId || 'anonymous'} joined auction ${auctionId}`);
      
      socket.to(`auction:${auctionId}`).emit('viewer:joined', { 
        userId, 
        viewerCount: io.sockets.adapter.rooms.get(`auction:${auctionId}`)?.size || 0 
      });

      socket.emit('auction:status', { auctionId, message: 'Connected to auction updates' });
    });

    socket.on('leaveAuction', ({ auctionId }) => {
      if (!auctionId) return;
      
      socket.leave(`auction:${auctionId}`);
      
      if (connectedUsers.has(socket.id)) {
        connectedUsers.get(socket.id).auctionIds.delete(auctionId);
      }

      console.log(`User ${socket.data.userId || 'anonymous'} left auction ${auctionId}`);
      
      socket.to(`auction:${auctionId}`).emit('viewer:left', { 
        userId: socket.data.userId,
        viewerCount: io.sockets.adapter.rooms.get(`auction:${auctionId}`)?.size || 0
      });
    });

    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    socket.on('reconnect:auctions', ({ userId, auctionIds }) => {
      if (!Array.isArray(auctionIds)) return;
      
      socket.data.userId = userId;
      
      auctionIds.forEach(auctionId => {
        socket.join(`auction:${auctionId}`);
        console.log(`User ${userId} reconnected to auction ${auctionId}`);
      });

      connectedUsers.set(socket.id, { userId, auctionIds: new Set(auctionIds) });
      
      socket.emit('reconnect:success', { rejoinedAuctions: auctionIds });
    });

    socket.on('disconnect', (reason) => {
      console.log(`Client disconnected: ${socket.id} (${reason})`);
      
      const userData = connectedUsers.get(socket.id);
      
      if (userData) {
        userData.auctionIds.forEach(auctionId => {
          socket.to(`auction:${auctionId}`).emit('viewer:left', { 
            userId: userData.userId,
            viewerCount: Math.max(0, (io.sockets.adapter.rooms.get(`auction:${auctionId}`)?.size || 1) - 1)
          });
        });
        
        connectedUsers.delete(socket.id);
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
      socket.emit('error', { message: 'Socket error occurred' });
    });
  });

  io.getRoomInfo = (auctionId) => {
    const room = io.sockets.adapter.rooms.get(`auction:${auctionId}`);
    return {
      viewerCount: room?.size || 0,
      viewers: Array.from(room || []).map(socketId => {
        const socket = io.sockets.sockets.get(socketId);
        return socket?.data?.userId || 'anonymous';
      })
    };
  };

  console.log('WebSocket server initialized');
}

module.exports = { initSockets };
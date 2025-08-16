let ioInstance = null;

function setIO(io) {
  ioInstance = io;
  console.log('Broadcast utility initialized');
}

function broadcastAuction(auctionId, event, payload) {
  if (!ioInstance) {
    console.warn('Socket.IO not initialized, cannot broadcast');
    return;
  }

  const room = `auction:${auctionId}`;
  const eventData = {
    ...payload,
    auctionId,
    timestamp: Date.now()
  };

  ioInstance.to(room).emit(event, eventData);
  
  const roomInfo = ioInstance.sockets.adapter.rooms.get(room);
  const viewerCount = roomInfo?.size || 0;
  
  console.log(`Broadcast [${event}] to auction ${auctionId} (${viewerCount} viewers):`, payload);
}

function notifyUser(userId, event, payload) {
  if (!ioInstance) {
    console.warn('Socket.IO not initialized, cannot notify user');
    return;
  }

  const userSockets = [];
  for (const [socketId, socket] of ioInstance.sockets.sockets) {
    if (socket.data.userId === userId) {
      userSockets.push(socketId);
    }
  }

  if (userSockets.length === 0) {
    console.log(`User ${userId} not connected, cannot send notification`);
    return;
  }

  const eventData = {
    ...payload,
    userId,
    timestamp: Date.now()
  };

  userSockets.forEach(socketId => {
    ioInstance.to(socketId).emit(event, eventData);
  });

  console.log(`Notified user ${userId} [${event}] on ${userSockets.length} connection(s):`, payload);
}

function broadcastGlobal(event, payload) {
  if (!ioInstance) {
    console.warn('Socket.IO not initialized, cannot broadcast globally');
    return;
  }

  const eventData = {
    ...payload,
    timestamp: Date.now()
  };

  ioInstance.emit(event, eventData);
  console.log(`Global broadcast [${event}]:`, payload);
}

function getAuctionStats(auctionId) {
  if (!ioInstance) return { viewerCount: 0, viewers: [] };
  return ioInstance.getRoomInfo ? ioInstance.getRoomInfo(auctionId) : { viewerCount: 0, viewers: [] };
}

function isInitialized() {
  return ioInstance !== null;
}

module.exports = { 
  setIO, 
  broadcastAuction, 
  notifyUser, 
  broadcastGlobal, 
  getAuctionStats,
  isInitialized 
};
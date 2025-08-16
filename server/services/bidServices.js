const redis = require('../redis');
const { Auction, Bid, User } = require('../models');
const { broadcastAuction, notifyUser } = require('../utils/broadcast');

async function setAuctionStatus(auctionId, status) {
  await redis.set(`auction:${auctionId}:status`, status);
}

async function cleanupAuction(auctionId) {
  await redis.del(`auction:${auctionId}:highest`);
  await redis.del(`auction:${auctionId}:lock`);
  await redis.del(`auction:${auctionId}:status`);
}

async function placeBid(auctionId, userId, amount) {
  const lockKey = `auction:${auctionId}:lock`;
  const lockToken = `${Date.now()}-${Math.random()}`;

  const lockAcquired = await redis.set(lockKey, lockToken, { nx: true, px: 2000 });
  if (lockAcquired !== 'OK') {
    throw new Error('BID_LOCKED');
  }

  try {
    const status = await redis.get(`auction:${auctionId}:status`);
    if (status !== 'live') throw new Error('AUCTION_NOT_LIVE');

    const highestRaw = await redis.get(`auction:${auctionId}:highest`);
    const highest = highestRaw;

    const auction = await Auction.findByPk(auctionId);
    const now = new Date();
    if (now < auction.startAt || now > auction.endAt) throw new Error('AUCTION_OUT_OF_WINDOW');

    const minAmount = Math.max(Number(auction.startingPrice), Number(highest?.amount) || 0) + Number(auction.bidIncrement);
    if (Number(amount) < minAmount) throw new Error('BID_TOO_LOW');

    const bid = await Bid.create({ auctionId, bidderId: userId, amount });

    const user = await User.findByPk(userId);

    const newHighestBid = {
      amount: Number(amount),
      bidId: bid.id,
      userId,
      displayName: user.displayName,
      at: Date.now(),
    };

    await redis.set(`auction:${auctionId}:highest`, JSON.stringify(newHighestBid));

    broadcastAuction(auctionId, 'bid:new', {
      bid: {
        id: bid.id,
        amount: Number(amount),
        bidderId: userId,
        bidderName: user.displayName,
        createdAt: bid.createdAt
      },
      auction: {
        id: auctionId,
        currentHighest: newHighestBid
      }
    });

    if (highest?.userId && highest.userId !== userId) {
      notifyUser(highest.userId, 'bid:outbid', {
        auctionId,
        outbidBy: {
          userId,
          displayName: user.displayName,
          amount: Number(amount)
        },
        previousAmount: highest.amount
      });

      broadcastAuction(auctionId, 'bid:outbid', {
        message: 'A bidder has been outbid',
        newLeadingBid: Number(amount)
      });
    }

    return bid;
  } finally {
    const val = await redis.get(lockKey);
    if (val === lockToken) await redis.del(lockKey);
  }
}

async function initializeAuction(auctionId) {
  await setAuctionStatus(auctionId, 'live');
  const auction = await Auction.findByPk(auctionId);
  
  if (auction.startingPrice > 0) {
    await redis.set(`auction:${auctionId}:highest`, JSON.stringify({
      amount: auction.startingPrice,
      bidId: null,
      userId: null,
      displayName: 'Starting Price',
      at: Date.now(),
    }));
  }

  broadcastAuction(auctionId, 'auction:started', {
    auction: {
      id: auctionId,
      title: auction.title,
      startingPrice: auction.startingPrice,
      bidIncrement: auction.bidIncrement,
      endAt: auction.endAt
    },
    message: 'Auction is now live and accepting bids!'
  });
}

async function endAuction(auctionId) {
  const auction = await Auction.findByPk(auctionId);
  const finalHighestBid = await redis.get(`auction:${auctionId}:highest`);
  
  await setAuctionStatus(auctionId, 'ended');

  broadcastAuction(auctionId, 'auction:ended', {
    auction: {
      id: auctionId,
      title: auction.title,
      status: auction.status
    },
    finalBid: finalHighestBid,
    message: 'Auction has ended!'
  });

  await cleanupAuction(auctionId);
}

module.exports = { 
  placeBid, 
  setAuctionStatus, 
  cleanupAuction, 
  initializeAuction, 
  endAuction 
};

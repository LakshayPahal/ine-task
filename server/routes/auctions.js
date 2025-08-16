const express = require('express');
const { Op } = require('sequelize');
const { Auction, Bid, User } = require('../models');
const { placeBid, endAuction } = require('../services/bidServices');
const { broadcastAuction, notifyUser } = require('../utils/broadcast');
const { sendBidAcceptedEmail, sendBidAcceptedSellerEmail, sendBidRejectedEmail, sendCounterOfferEmail, sendCounterOfferRejectedEmail } = require('../services/emailService');
const { generateInvoice } = require('../services/invoiceService');
const redis = require('../redis');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { status = 'live', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = {};
    const now = new Date();
    
    switch (status) {
      case 'live':
        whereClause = {
          startAt: { [Op.lte]: now },
          endAt: { [Op.gt]: now },
          status: 'live'
        };
        break;
      case 'scheduled':
        whereClause = {
          startAt: { [Op.gt]: now },
          status: 'scheduled'
        };
        break;
      case 'ended':
        whereClause = {
          endAt: { [Op.lte]: now },
          status: 'ended'
        };
        break;

      default:
        whereClause = { status };
    }
    
    const auctions = await Auction.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'seller',
          attributes: ['id', 'displayName']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    const auctionsWithBids = await Promise.all(
      auctions.rows.map(async (auction) => {
        const auctionData = auction.toJSON();
        
        if (status === 'live') {
          try {
            const highestBidRaw = await redis.get(`auction:${auction.id}:highest`);
            auctionData.currentHighestBid = highestBidRaw || null;
          } catch (error) {
            console.error(`Error fetching highest bid for auction ${auction.id}:`, error);
            auctionData.currentHighestBid = null;
          }
        }
        
        return auctionData;
      })
    );
    
    res.json({
      auctions: auctionsWithBids,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: auctions.count,
        totalPages: Math.ceil(auctions.count / limit)
      }
    });
    
  } catch (error) {
    console.error('Error fetching auctions:', error);
    res.status(500).json({ error: 'Failed to fetch auctions' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const auction = await Auction.findByPk(id, {
      include: [
        {
          model: User,
          as: 'seller',
          attributes: ['id', 'displayName', 'email']
        },
        {
          model: Bid,
          as: 'bids',
          include: [
            {
              model: User,
              as: 'bidder',
              attributes: ['id', 'displayName']
            }
          ],
          order: [['amount', 'DESC']],
          limit: 10
        }
      ]
    });
    
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    
    const auctionData = auction.toJSON();
    
    try {
      const highestBidRaw = await redis.get(`auction:${id}:highest`);
      auctionData.currentHighestBid = highestBidRaw || null;
      
      const auctionStatus = await redis.get(`auction:${id}:status`);
      auctionData.liveStatus = auctionStatus || null;
    } catch (error) {
      console.error(`Error fetching Redis data for auction ${id}:`, error);
      auctionData.currentHighestBid = null;
      auctionData.liveStatus = null;
    }
    
    res.json(auctionData);
    
  } catch (error) {
    console.error('Error fetching auction details:', error);
    res.status(500).json({ error: 'Failed to fetch auction details' });
  }
});

router.post('/:id/bid', authenticateUser, async (req, res) => {
  try {
    const { id: auctionId } = req.params;
    const { amount } = req.body;
    const userId = req.user.id;
    
    if (!userId || !amount) {
      return res.status(400).json({ 
        error: 'userId and amount are required' 
      });
    }
    
    if (amount <= 0) {
      return res.status(400).json({ 
        error: 'Bid amount must be positive' 
      });
    }
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const auction = await Auction.findByPk(auctionId);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    
    if (auction.sellerId === userId) {
      return res.status(403).json({ 
        error: 'Cannot bid on your own auction' 
      });
    }
    
    const bid = await placeBid(auctionId, userId, amount);
    
    res.status(201).json({
      message: 'Bid placed successfully',
      bid: {
        id: bid.id,
        amount: bid.amount,
        auctionId: bid.auctionId,
        bidderId: bid.bidderId,
        createdAt: bid.createdAt
      }
    });
    
  } catch (error) {
    console.error('Error placing bid:', error);
    
    if (error.message === 'BID_LOCKED') {
      return res.status(409).json({ 
        error: 'Another bid is being processed. Please try again.' 
      });
    }
    
    if (error.message === 'AUCTION_NOT_LIVE') {
      return res.status(400).json({ 
        error: 'Auction is not currently live' 
      });
    }
    
    if (error.message === 'AUCTION_OUT_OF_WINDOW') {
      return res.status(400).json({ 
        error: 'Auction is not within the bidding window' 
      });
    }
    
    if (error.message === 'BID_TOO_LOW') {
      return res.status(400).json({ 
        error: 'Bid amount is too low' 
      });
    }
    
    res.status(500).json({ error: 'Failed to place bid' });
  }
});

router.delete('/:auctionId/bid/:bidId', authenticateUser, async (req, res) => {
  try {
    const { auctionId, bidId } = req.params;
    const userId = req.user.id;
    
    const bid = await Bid.findByPk(bidId, {
      include: [{ model: Auction, as: 'auction' }]
    });
    
    if (!bid) {
      return res.status(404).json({ error: 'Bid not found' });
    }
    
    if (bid.bidderId !== userId) {
      return res.status(403).json({ error: 'Can only delete your own bids' });
    }
    
    if (bid.auction.status !== 'live') {
      return res.status(400).json({ error: 'Can only delete bids from live auctions' });
    }
    
    const highestBidRaw = await redis.get(`auction:${auctionId}:highest`);
    if (highestBidRaw && highestBidRaw.bidId === bidId) {
      return res.status(400).json({ 
        error: 'Cannot delete the current highest bid' 
      });
    }
    
    await bid.destroy();
    
    res.json({ message: 'Bid deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting bid:', error);
    res.status(500).json({ error: 'Failed to delete bid' });
  }
});

router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const { id: auctionId } = req.params;
    const sellerId = req.user.id;
    
    if (!sellerId) return res.status(401).json({ error: 'Unauthorized' });
    
    const auction = await Auction.findByPk(auctionId);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    
    if (auction.sellerId !== sellerId) {
      return res.status(403).json({ 
        error: 'Only the auction owner can delete this auction' 
      });
    }
    

    if (auction.status === 'live') {
      try {
        await redis.del(`auction:${auctionId}:highest`);
        await redis.del(`auction:${auctionId}:status`);
      } catch (error) {
        console.error('Error cleaning up Redis data:', error);
      }
    }
    
    await Bid.destroy({
      where: { auctionId: auctionId }
    });
    
    await auction.destroy();
    
    res.json({ message: 'Auction deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting auction:', error);
    res.status(500).json({ error: 'Failed to delete auction' });
  }
});

router.post('/', authenticateUser, async (req, res) => {
  try {
    const { 
      title, 
      description, 
      startingPrice, 
      bidIncrement, 
      startAt, 
      endAt 
    } = req.body;
    const sellerId = req.user.id;
    
    if (!sellerId || !title || !startingPrice || !bidIncrement || !startAt || !endAt) {
      return res.status(400).json({ 
        error: 'All required fields must be provided' 
      });
    }
    
    const seller = await User.findByPk(sellerId);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }
    
    const startDate = new Date(startAt);
    const endDate = new Date(endAt);
    const now = new Date();
    
    if (startDate <= now) {
      return res.status(400).json({ 
        error: 'Start time must be in the future' 
      });
    }
    
    if (endDate <= startDate) {
      return res.status(400).json({ 
        error: 'End time must be after start time' 
      });
    }
    
    const auction = await Auction.create({
      sellerId,
      title,
      description,
      startingPrice: parseFloat(startingPrice),
      bidIncrement: parseFloat(bidIncrement),
      startAt: startDate,
      endAt: endDate,
      status: 'scheduled'
    });
    
    res.status(201).json({
      message: 'Auction created successfully',
      auction: {
        id: auction.id,
        title: auction.title,
        description: auction.description,
        startingPrice: auction.startingPrice,
        bidIncrement: auction.bidIncrement,
        startAt: auction.startAt,
        endAt: auction.endAt,
        status: auction.status,
        sellerId: auction.sellerId
      }
    });
    
  } catch (error) {
    console.error('Error creating auction:', error);
    res.status(500).json({ error: 'Failed to create auction' });
  }
});

router.post('/:id/accept', authenticateUser, async (req, res) => {
  try {
    const { id: auctionId } = req.params;
    const sellerId = req.user.id;
    
    if (!sellerId) return res.status(401).json({ error: 'Unauthorized' });
    
    const auction = await Auction.findByPk(auctionId);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    
    if (auction.sellerId !== sellerId) {
      return res.status(403).json({ 
        error: 'Only the auction owner can accept bids' 
      });
    }
    
    const highestBidRaw = await redis.get(`auction:${auctionId}:highest`);
    if (!highestBidRaw) {
      return res.status(400).json({ error: 'No bids to accept' });
    }
    
    await auction.update({ status: 'closed' });
    await endAuction(auctionId);
    
    const fullAuction = await Auction.findByPk(auctionId, {
      include: [{ model: User, as: 'seller' }]
    });
    
    const winner = await User.findByPk(highestBidRaw.userId);
    
    let invoiceBuffer = null;
    try {
      if (winner && fullAuction.seller) {
        invoiceBuffer = await generateInvoice({
          auction: fullAuction,
          buyer: winner,
          seller: fullAuction.seller,
          amount: highestBidRaw.amount,
          bidId: highestBidRaw.bidId
        });
        console.log('Invoice generated successfully');
      }
    } catch (error) {
      console.error('Failed to generate invoice:', error);
    }

    try {
      if (winner) {
        await sendBidAcceptedEmail(winner, fullAuction, highestBidRaw.amount, invoiceBuffer);
        console.log('Acceptance email sent to buyer');
      }
      
      if (fullAuction.seller) {
        await sendBidAcceptedSellerEmail(
          fullAuction.seller, 
          fullAuction, 
          highestBidRaw.amount, 
          winner?.displayName || 'Unknown Buyer', 
          invoiceBuffer
        );
        console.log('Confirmation email sent to seller');
      }
    } catch (error) {
      console.error('Failed to send emails:', error);
    }
    
    broadcastAuction(auctionId, 'seller:decision', {
      decision: 'ACCEPTED',
      auction: {
        id: auctionId,
        title: auction.title,
        status: 'closed'
      },
      winningBid: {
        ...highestBidRaw,
        winnerName: winner?.displayName || 'Unknown'
      },
      message: 'Congratulations! The seller has accepted the winning bid!'
    });

    if (highestBidRaw.userId) {
      notifyUser(highestBidRaw.userId, 'auction:won', {
        auctionId,
        auction: {
          title: auction.title,
          sellerName: fullAuction.seller?.displayName || 'Seller'
        },
        winningBid: highestBidRaw,
        message: `Congratulations! You won the auction for "${auction.title}"!`
      });
    }
    
    res.json({
      message: 'Bid accepted successfully',
      auction: {
        id: auction.id,
        status: 'closed'
      },
      winningBid: highestBidRaw
    });
    
  } catch (error) {
    console.error('Error accepting bid:', error);
    res.status(500).json({ error: 'Failed to accept bid' });
  }
});

router.post('/:id/reject', authenticateUser, async (req, res) => {
  try {
    const { id: auctionId } = req.params;
    const sellerId = req.user.id;
    
    if (!sellerId) return res.status(401).json({ error: 'Unauthorized' });
    
    const auction = await Auction.findByPk(auctionId);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    
    if (auction.sellerId !== sellerId) {
      return res.status(403).json({ 
        error: 'Only the auction owner can reject bids' 
      });
    }
    
    const highestBidRaw = await redis.get(`auction:${auctionId}:highest`);
    
    await auction.update({ status: 'ended' });
    await endAuction(auctionId);
    
    if (highestBidRaw?.userId) {
      try {
        const buyer = await User.findByPk(highestBidRaw.userId);
        if (buyer) {
          await sendBidRejectedEmail(buyer, auction, highestBidRaw.amount);
          console.log('Rejection email sent to buyer');
        }
      } catch (error) {
        console.error('Failed to send rejection email:', error);
      }
    }
      
    broadcastAuction(auctionId, 'seller:decision', {
      decision: 'REJECTED',
      auction: {
        id: auctionId,
        title: auction.title,
        status: 'ended'
      },
      rejectedBid: highestBidRaw,
      message: 'The seller has rejected all bids. Auction ended without a sale.'
    });
    
    if (highestBidRaw?.userId) {
      notifyUser(highestBidRaw.userId, 'bid:rejected', {
        auctionId,
        auction: {
          title: auction.title
        },
        rejectedBid: highestBidRaw,
        message: `Your bid on "${auction.title}" was not accepted by the seller.`
      });
    }
    
    res.json({
      message: 'Bid rejected successfully',
      auction: {
        id: auction.id,
        status: 'ended'
      }
    });
    
  } catch (error) {
    console.error('Error rejecting bid:', error);
    res.status(500).json({ error: 'Failed to reject bid' });
  }
});

router.post('/:id/counter-offer', authenticateUser, async (req, res) => {
  try {
    const { id: auctionId } = req.params;
    const { counterOfferAmount } = req.body;
    const sellerId = req.user.id;
    
    if (!sellerId || !counterOfferAmount) {
      return res.status(400).json({ 
        error: 'sellerId and counterOfferAmount are required' 
      });
    }
    
    const counterOffer = parseFloat(counterOfferAmount);
    if (isNaN(counterOffer) || counterOffer <= 0) {
      return res.status(400).json({ 
        error: 'Valid counter offer amount is required' 
      });
    }
    
    const auction = await Auction.findByPk(auctionId);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    
    if (auction.sellerId !== sellerId) {
      return res.status(403).json({ 
        error: 'Only the auction owner can make counter offers' 
      });
    }
    
    if (auction.status !== 'ended') {
      return res.status(400).json({ 
        error: 'Counter offers can only be made on ended auctions' 
      });
    }
    
    const highestBidRaw = await redis.get(`auction:${auctionId}:highest`);
    if (!highestBidRaw) {
      return res.status(400).json({ error: 'No bids to counter offer' });
    }
    
    const highestBid = JSON.parse(highestBidRaw);
    
    const counterOfferData = {
      auctionId,
      sellerId,
      buyerId: highestBid.userId,
      originalBid: highestBid.amount,
      counterOfferAmount: counterOffer,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() 
    };
    
    await redis.set(
      `counter-offer:${auctionId}`, 
      JSON.stringify(counterOfferData),
      { ex: 24 * 60 * 60 } 
    );
    
    await auction.update({ status: 'counter-offer' });
    
    const buyer = await User.findByPk(highestBid.userId);
    const fullAuction = await Auction.findByPk(auctionId, {
      include: [{ model: User, as: 'seller' }]
    });
    
    try {
      if (buyer) {
        await sendCounterOfferEmail(buyer, fullAuction, highestBid.amount, counterOffer);
        console.log('Counter offer email sent to buyer');
      }
    } catch (error) {
      console.error('Failed to send counter offer email:', error);
    }
    
    broadcastAuction(auctionId, 'counter-offer:made', {
      auction: {
        id: auctionId,
        title: auction.title,
        status: 'counter-offer'
      },
      counterOffer: {
        originalBid: highestBid.amount,
        counterOfferAmount: counterOffer,
        buyerId: highestBid.userId,
        buyerName: buyer?.displayName || 'Unknown'
      },
      message: `The seller has made a counter offer of ₹${counterOffer.toLocaleString('en-IN')} (Original bid: ₹${highestBid.amount.toLocaleString('en-IN')})`
    });
    
    if (highestBid.userId) {
      notifyUser(highestBid.userId, 'counter-offer:received', {
        auctionId,
        auction: {
          title: auction.title,
          sellerName: fullAuction.seller?.displayName || 'Seller'
        },
        counterOffer: {
          originalBid: highestBid.amount,
          counterOfferAmount: counterOffer
        },
        message: `You received a counter offer of ₹${counterOffer.toLocaleString('en-IN')} for "${auction.title}"`
      });
    }
    
    res.json({
      message: 'Counter offer sent successfully',
      auction: {
        id: auction.id,
        status: 'counter-offer'
      },
      counterOffer: counterOfferData
    });
    
  } catch (error) {
    console.error('Error making counter offer:', error);
    res.status(500).json({ error: 'Failed to make counter offer' });
  }
});

router.post('/:id/counter-offer/accept', authenticateUser, async (req, res) => {
  try {
    const { id: auctionId } = req.params;
    const buyerId = req.user.id;
    
    if (!buyerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const counterOfferRaw = await redis.get(`counter-offer:${auctionId}`);
    if (!counterOfferRaw) {
      return res.status(404).json({ error: 'Counter offer not found or expired' });
    }
    
    const counterOffer = JSON.parse(counterOfferRaw);
    
    if (counterOffer.buyerId !== buyerId) {
      return res.status(403).json({ 
        error: 'Only the designated buyer can accept this counter offer' 
      });
    }
    
    if (counterOffer.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Counter offer is no longer available' 
      });
    }
    
    const auction = await Auction.findByPk(auctionId);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    
    counterOffer.status = 'accepted';
    counterOffer.acceptedAt = new Date().toISOString();
    await redis.set(`counter-offer:${auctionId}`, JSON.stringify(counterOffer), { ex: 24 * 60 * 60 });
    
    await auction.update({ status: 'closed' });
    await endAuction(auctionId);
    
    const buyer = await User.findByPk(buyerId);
    const fullAuction = await Auction.findByPk(auctionId, {
      include: [{ model: User, as: 'seller' }]
    });
    
    let invoiceBuffer = null;
    try {
      if (buyer && fullAuction.seller) {
        invoiceBuffer = await generateInvoice({
          auction: fullAuction,
          buyer: buyer,
          seller: fullAuction.seller,
          amount: counterOffer.counterOfferAmount,
          bidId: null // No specific bid for counter offers
        });
        console.log('Counter offer invoice generated successfully');
      }
    } catch (error) {
      console.error('Failed to generate counter offer invoice:', error);
    }
    
    try {
      if (buyer) {
        await sendBidAcceptedEmail(buyer, fullAuction, counterOffer.counterOfferAmount, invoiceBuffer);
        console.log('Counter offer acceptance email sent to buyer');
      }
      
      if (fullAuction.seller) {
        await sendBidAcceptedSellerEmail(
          fullAuction.seller, 
          fullAuction, 
          counterOffer.counterOfferAmount, 
          buyer?.displayName || 'Unknown Buyer', 
          invoiceBuffer
        );
        console.log('Counter offer confirmation email sent to seller');
      }
    } catch (error) {
      console.error('Failed to send counter offer emails:', error);
    }
    
    broadcastAuction(auctionId, 'counter-offer:accepted', {
      auction: {
        id: auctionId,
        title: auction.title,
        status: 'closed'
      },
      counterOffer: {
        finalAmount: counterOffer.counterOfferAmount,
        buyerId: buyerId,
        buyerName: buyer?.displayName || 'Unknown'
      },
      message: `Counter offer accepted! Final sale price: ₹${counterOffer.counterOfferAmount.toLocaleString('en-IN')}`
    });
    
    notifyUser(buyerId, 'counter-offer:success', {
      auctionId,
      auction: {
        title: auction.title,
        sellerName: fullAuction.seller?.displayName || 'Seller'
      },
      finalAmount: counterOffer.counterOfferAmount,
      message: `Congratulations! You accepted the counter offer for "${auction.title}" at ₹${counterOffer.counterOfferAmount.toLocaleString('en-IN')}`
    });
    
    notifyUser(auction.sellerId, 'counter-offer:buyer-accepted', {
      auctionId,
      auction: {
        title: auction.title
      },
      buyerName: buyer?.displayName || 'Unknown',
      finalAmount: counterOffer.counterOfferAmount,
      message: `Great! The buyer accepted your counter offer of ₹${counterOffer.counterOfferAmount.toLocaleString('en-IN')} for "${auction.title}"`
    });
    
    res.json({
      message: 'Counter offer accepted successfully',
      auction: {
        id: auction.id,
        status: 'closed'
      },
      finalAmount: counterOffer.counterOfferAmount
    });
    
  } catch (error) {
    console.error('Error accepting counter offer:', error);
    res.status(500).json({ error: 'Failed to accept counter offer' });
  }
});

router.post('/:id/counter-offer/reject', authenticateUser, async (req, res) => {
  try {
    const { id: auctionId } = req.params;
    const buyerId = req.user.id;
    
    if (!buyerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const counterOfferRaw = await redis.get(`counter-offer:${auctionId}`);
    if (!counterOfferRaw) {
      return res.status(404).json({ error: 'Counter offer not found or expired' });
    }
    
    const counterOffer = JSON.parse(counterOfferRaw);
    
    if (counterOffer.buyerId !== buyerId) {
      return res.status(403).json({ 
        error: 'Only the designated buyer can reject this counter offer' 
      });
    }
    
    if (counterOffer.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Counter offer is no longer available' 
      });
    }
    
    const auction = await Auction.findByPk(auctionId);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }
    
    counterOffer.status = 'rejected';
    counterOffer.rejectedAt = new Date().toISOString();
    await redis.set(`counter-offer:${auctionId}`, JSON.stringify(counterOffer), { ex: 24 * 60 * 60 });
    
    await auction.update({ status: 'ended' });
    await endAuction(auctionId);
    
    const buyer = await User.findByPk(buyerId);
    const fullAuction = await Auction.findByPk(auctionId, {
      include: [{ model: User, as: 'seller' }]
    });
    
    try {
      if (buyer) {
        await sendCounterOfferRejectedEmail(buyer, fullAuction, counterOffer.counterOfferAmount);
        console.log('Counter offer rejection email sent to buyer');
      }
    } catch (error) {
      console.error('Failed to send counter offer rejection email:', error);
    }
    
    broadcastAuction(auctionId, 'counter-offer:rejected', {
      auction: {
        id: auctionId,
        title: auction.title,
        status: 'ended'
      },
      counterOffer: {
        rejectedAmount: counterOffer.counterOfferAmount,
        buyerId: buyerId,
        buyerName: buyer?.displayName || 'Unknown'
      },
      message: `Counter offer of ₹${counterOffer.counterOfferAmount.toLocaleString('en-IN')} was rejected. Auction ended without a sale.`
    });
    
    notifyUser(buyerId, 'counter-offer:rejected-confirmed', {
      auctionId,
      auction: {
        title: auction.title,
        sellerName: fullAuction.seller?.displayName || 'Seller'
      },
      rejectedAmount: counterOffer.counterOfferAmount,
      message: `You rejected the counter offer of ₹${counterOffer.counterOfferAmount.toLocaleString('en-IN')} for "${auction.title}"`
    });
    
    notifyUser(auction.sellerId, 'counter-offer:buyer-rejected', {
      auctionId,
      auction: {
        title: auction.title
      },
      buyerName: buyer?.displayName || 'Unknown',
      rejectedAmount: counterOffer.counterOfferAmount,
      message: `The buyer rejected your counter offer of ₹${counterOffer.counterOfferAmount.toLocaleString('en-IN')} for "${auction.title}"`
    });
    
    res.json({
      message: 'Counter offer rejected',
      auction: {
        id: auction.id,
        status: 'ended'
      }
    });
    
  } catch (error) {
    console.error('Error rejecting counter offer:', error);
    res.status(500).json({ error: 'Failed to reject counter offer' });
  }
});

router.get('/:id/counter-offer', async (req, res) => {
  try {
    const { id: auctionId } = req.params;
    
    const counterOfferRaw = await redis.get(`counter-offer:${auctionId}`);
    if (!counterOfferRaw) {
      return res.status(404).json({ error: 'No counter offer found' });
    }
    
    const counterOffer = JSON.parse(counterOfferRaw);
      
    if (new Date() > new Date(counterOffer.expiresAt)) {
      await redis.del(`counter-offer:${auctionId}`);
      return res.status(404).json({ error: 'Counter offer has expired' });
    }
    
    res.json({
      counterOffer: counterOffer
    });
    
  } catch (error) {
    console.error('Error fetching counter offer:', error);
    res.status(500).json({ error: 'Failed to fetch counter offer' });
  }
});

module.exports = router;
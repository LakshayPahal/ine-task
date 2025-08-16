const express = require('express');
const { Auction } = require('../models');
const { initializeAuction, endAuction } = require('../services/bidServices');
const { Op } = require('sequelize');
const router = express.Router();

router.post('/tick', async (_req, res) => {
  try {
    const now = new Date();
    console.log(`Cron tick at ${now.toISOString()}`);
    
    let startedCount = 0;
    let endedCount = 0;
    
    const auctionsToStart = await Auction.findAll({
      where: {
        startAt: { [Op.lte]: now },
        status: 'scheduled'
      }
    });
    
    for (const auction of auctionsToStart) {
      try {
        await initializeAuction(auction.id);
        await auction.update({ status: 'live' });
        startedCount++;
        
        console.log(`Started auction ${auction.id}: ${auction.title}`);
        
      } catch (error) {
        console.error(`Error starting auction ${auction.id}:`, error);
      }
    }
    
    const auctionsToEnd = await Auction.findAll({
      where: {
        endAt: { [Op.lte]: now },
        status: 'live'
      }
    });
    
    for (const auction of auctionsToEnd) {
      try {
        await endAuction(auction.id);
        await auction.update({ status: 'ended' });
        endedCount++;
        
        console.log(`Ended auction ${auction.id}: ${auction.title}`);
        
      } catch (error) {
        console.error(`Error ending auction ${auction.id}:`, error);
      }
    }
    
    res.json({
      message: 'Cron tick completed successfully',
      timestamp: now.toISOString(),
      results: {
        auctionsStarted: startedCount,
        auctionsEnded: endedCount
      }
    });
    
  } catch (error) {
    console.error('Error in cron tick:', error);
    res.status(500).json({ 
      error: 'Cron tick failed',
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/status', async (req, res) => {
  try {
    const now = new Date();
    
    const stats = await Promise.all([
      Auction.count({ where: { status: 'scheduled' } }),
      Auction.count({ where: { status: 'live' } }),
      Auction.count({ where: { status: 'ended' } }),
      Auction.count({ where: { status: 'sold' } })
    ]);
    
    const nextAuction = await Auction.findOne({
      where: {
        status: 'scheduled',
        startAt: { [Op.gt]: now }
      },
      order: [['startAt', 'ASC']],
      attributes: ['id', 'title', 'startAt']
    });
    
    const endingSoon = await Auction.findAll({
      where: {
        status: 'live',
        endAt: { 
          [Op.between]: [now, new Date(now.getTime() + 60 * 60 * 1000)] // Next hour
        }
      },
      order: [['endAt', 'ASC']],
      attributes: ['id', 'title', 'endAt'],
      limit: 5
    });
    
    res.json({
      timestamp: now.toISOString(),
      status: 'healthy',
      statistics: {
        scheduled: stats[0],
        live: stats[1],
        ended: stats[2],
        sold: stats[3]
      },
      nextAuction,
      endingSoon
    });
    
  } catch (error) {
    console.error('Error getting cron status:', error);
    res.status(500).json({ 
      error: 'Failed to get cron status',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
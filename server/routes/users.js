const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authenticateUser } = require('../middleware/auth');
const router = express.Router();

function signJwtForUser(user) {
  const secret = process.env.JWT_SECRET || 'devsecret';
  const payload = {
    userId: user.id,
    email: user.email,
    name: user.displayName
  };
  const options = {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  };
  if (process.env.JWT_ISS) options.issuer = process.env.JWT_ISS;
  if (process.env.JWT_AUD) options.audience = process.env.JWT_AUD;
  return jwt.sign(payload, secret, options);
}

router.post('/guest', async (req, res) => {
  try {
    const { displayName, email } = req.body;
    
    if (!displayName || !email) {
      return res.status(400).json({ 
        error: 'displayName and email are required' 
      });
    }
    
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      const token = signJwtForUser(existingUser);
      return res.status(200).json({
        id: existingUser.id,
        displayName: existingUser.displayName,
        email: existingUser.email,
        token
      });
    }
    
    const user = await User.create({
      displayName,
      email
    });
    
    const token = signJwtForUser(user);
    res.status(201).json({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      token
    });
    
  } catch (error) {
    console.error('Error creating guest user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Return current authenticated user profile
router.get('/me', authenticateUser, async (req, res) => {
  res.json({ id: req.user.id, displayName: req.user.displayName, email: req.user.email });
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByPk(id, {
      attributes: ['id', 'displayName', 'email', 'createdAt']
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
    
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
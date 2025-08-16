const User = require('./user');
const Auction = require('./auction');
const Bid = require('./bid');

User.hasMany(Auction, { foreignKey: 'sellerId', as: 'auctions' });
Auction.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });

User.hasMany(Bid, { foreignKey: 'bidderId', as: 'bids' });
Bid.belongsTo(User, { foreignKey: 'bidderId', as: 'bidder' });

Auction.hasMany(Bid, { foreignKey: 'auctionId', as: 'bids' });
Bid.belongsTo(Auction, { foreignKey: 'auctionId', as: 'auction' });

module.exports = {
  User,
  Auction,
  Bid,
};

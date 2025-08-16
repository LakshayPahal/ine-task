const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Auction = sequelize.define('Auction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  startingPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  bidIncrement: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  startAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  endAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'live', 'ended', 'closed'),
    defaultValue: 'scheduled',
  },
}, {
  tableName: 'auctions',
  timestamps: true,
});

module.exports = Auction;

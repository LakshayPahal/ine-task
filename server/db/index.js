const { Sequelize } = require('sequelize');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Set it in environment variables for local testing.');
}

const useSSL = (process.env.DB_SSL === 'true') || (process.env.NODE_ENV === 'production');
const logging = process.env.SEQUELIZE_LOGGING === 'false' ? false : console.log;

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  dialectOptions: useSSL
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : {},
  logging,
});

module.exports = sequelize;

# Mini-Auction Platform (INE Assessment)

A comprehensive, production-ready auction platform featuring real-time bidding, JWT authentication, counter-offer negotiations, and automated auction lifecycle management. Built with modern web technologies for scalability and performance.

## Overview

This is a full-stack auction application that enables users to create, participate in, and manage online auctions with real-time capabilities. The platform supports the complete auction lifecycle from creation to settlement, including advanced features like counter-offers and automated PDF invoice generation.

---

## Key Features

### **Authentication & Authorization**

- Simple JWT-based authentication (name + email)
- Protected routes for auction creation and bidding
- Secure middleware validation
- LocalStorage token management

### **Auction Management**

- **Seller Console**: Create, edit, and delete auctions
- **Auction Lifecycle**: Automated status transitions (scheduled → live → ended)
- **Flexible Scheduling**: Set custom start/end times with validation
- **Rich Metadata**: Title, description, starting price, bid increments

### **Advanced Bidding System**

- **Real-time Bidding**: Instant updates via WebSockets
- **Bid Validation**: Minimum increment enforcement
- **Concurrent Bidding**: Redis-based locking for race condition prevention
- **Bid History**: Complete audit trail with timestamps
- **Delete Future Bids**: Users can retract their own bids

### **Counter-Offer System**

- Sellers can propose counter-offers to highest bidders
- Buyers can accept/reject counter-offers
- Status tracking and email notifications
- Automatic invoice generation upon acceptance

### **Real-time Updates**

- **WebSocket Rooms**: Per-auction communication channels
- **Live Viewer Count**: See active participants
- **Instant Notifications**: Bid updates, auction status changes
- **Reconnection Handling**: Automatic rejoin on connection restore

### **Document Generation**

- **PDF Invoices**: Professional invoices with auction details
- **Email Integration**: SendGrid for automated notifications
- **File Management**: Temporary file cleanup

### **Automated Operations**

- **Cron Scheduling**: HTTP endpoint for status transitions
- **External Scheduling**: Compatible with cron-job.org
- **Health Monitoring**: Status endpoints for system health

---

## Architecture

### **Frontend (React + Vite)**

```Markdown
client/
├── src/
│   ├── pages/                 # Route components
│   │   ├── Home.jsx               # Auction listings (live/scheduled/ended)
│   │   ├── AuctionDetail.jsx      # Individual auction with bidding interface
│   │   └── SellerConsole.jsx      # Auction management dashboard
│   ├── components/            # Reusable UI components
│   │   ├── Layout.jsx             # Navigation, notifications, auth   
│   │   ├── Login.jsx              # Authentication modal
│   │   ├── BidBox.jsx             # Real-time bidding interface
│   │   ├── AuctionCard.jsx        # Auction preview cards
│   │   ├── Countdown.jsx          # Time remaining display
│   │   └── RequireAuth.jsx        # Protected route wrapper
│   ├── hooks/                 # Custom React hooks
│   │   └── useAuth.js             # Authentication state management
│   ├── api/                   # External communication
│   │   ├── axios.js               # HTTP client with JWT interceptors
│   │   └── socket.js              # WebSocket client setup
│   └── App.jsx                # Main router and layout
```

### **Backend (Node.js + Express)**

```Markdown
server/
├── models/                  # Sequelize ORM models
│   ├── auction.js                # Auction schema with statuses
│   ├── bid.js                    # Bid records with relationships
│   ├── user.js                   # User profiles
│   └── index.js                  # Model associations
├── routes/                  # REST API endpoints
│   ├── auctions.js               # CRUD, bidding, counter-offers
│   ├── users.js                  # Authentication endpoints
│   └── cron.js                   # Automated status transitions
├── services/               # Business logic
│   ├── bidServices.js            # Bid placement, validation, locking
│   ├── emailService.js           # SendGrid integration
│   └── invoiceService.js         # PDF generation with PDFKit
├── middleware/             # Request processing
│   └── auth.js                   # JWT validation middleware
├── utils/                  # Helper functions
│   └── broadcast.js              # WebSocket message broadcasting
├── app.js                  # Express server setup
└── ws.js                   # Socket.IO configuration
```

### **Database Schema**

- **Users**: UUID, displayName, email, timestamps
- **Auctions**: UUID, title, description, pricing, timing, status, seller relationship
- **Bids**: UUID, amount, timestamps, user/auction relationships
- **Status Flow**: scheduled → live → ended → closed

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Vite, Tailwind CSS, Axios, Socket.IO Client |
| **Backend** | Node.js, Express.js, Socket.IO, Sequelize ORM |
| **Database** | PostgreSQL (Supabase/local) |
| **Caching** | Redis (Upstash/local) |
| **Authentication** | JSON Web Tokens (JWT) |
| **Real-time** | WebSockets (Socket.IO) |
| **PDF Generation** | PDFKit |
| **Email** | SendGrid |
| **Deployment** | Docker, Render.com |
| **Scheduling** | cron-job.org |

## Quick Start

### Prerequisites

- **Node.js** v18+ (v20 recommended)
- **PostgreSQL** database (local or cloud)
- **Redis**

### Installation

```bash
# Clone the repository
git https://github.com/LakshayPahal/ine-task.git
cd ine-assessment

# Install all dependencies
npm run install:all

# OR install separately:
cd server && npm install
cd ../client && npm install
```

### Environment Configuration

#### Server Environment (`server/.env`)

```env

PORT=3000
NODE_ENV=development
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
JWT_SECRET=your-jwt-secret-key-here

UPSTASH_REDIS_REST_URL="https://your-upstash.upstash.io"
UPSTASH_REDIS_REST_TOKEN=""

SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM=no-reply@example.com
REDIS_URL=redis://localhost:6379
```

#### Client Environment (`client/.env.local`)

```env
# Development
VITE_API_URL=http://localhost:3000/api
VITE_API_WS=http://localhost:3000

# Production (set during build)
# VITE_API_URL=https://your-app.onrender.com/api  
# VITE_API_WS=https://your-app.onrender.com
```

### Run the Application

#### Development Mode

```bash
# Terminal 1: Start backend server
cd server
npm start

# Terminal 2: Start frontend dev server  
cd client
npm run dev
```

## API Reference

### Base URL

```Markdown
Development: http://localhost:3000/api
Production: https://your-app.onrender.com/api
```

### User Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/users/guest` | ❌ | Register/login user |
| `GET` | `/users/me` | ✅ | Get current user |

### Auction Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/auctions?status=live\|scheduled\|ended` | ❌ | List auctions by status |
| `GET` | `/auctions/:id` | ❌ | Get auction details |
| `POST` | `/auctions` | ✅ | Create new auction |
| `DELETE` | `/auctions/:id` | ✅ | Delete auction (owner only) |

### Bidding System  

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auctions/:id/bid` | ✅ | Place bid |
| `DELETE` | `/auctions/:auctionId/bid/:bidId` | ✅ | Delete own bid |

### Counter-Offer System

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auctions/:id/counter-offer` | ✅ | Send counter-offer (seller) |
| `POST` | `/auctions/:id/counter-offer/accept` | ✅ | Accept counter-offer (buyer) |
| `POST` | `/auctions/:id/counter-offer/reject` | ✅ | Reject counter-offer (buyer) |

### Automation & Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/cron/tick` | ❌ | Process auction status transitions |
| `GET` | `/cron/status` | ❌ | System health and statistics |

### Request/Response Examples

#### Create Auction

```bash
curl -X POST http://localhost:3000/api/auctions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Vintage Guitar",
    "description": "1960s Fender Stratocaster",
    "startingPrice": 1000,
    "bidIncrement": 50,
    "startAt": "2024-01-15T10:00:00Z",
    "endAt": "2024-01-16T10:00:00Z"
  }'
```

#### Place Bid

```bash
curl -X POST http://localhost:3000/api/auctions/123/bid \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "amount": 1050 }'
```

---

## Real-time Features (WebSocket)

### Connection Setup

```javascript
// Client connects to WebSocket server
import { io } from 'socket.io-client';
const socket = io(process.env.VITE_API_WS);

// Join auction room for updates
socket.emit('joinAuction', { 
  auctionId: 'auction-uuid', 
  userId: 'user-uuid' 
});
```

### WebSocket Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `joinAuction` | `{ auctionId, userId }` | Join auction room |
| `leaveAuction` | `{ auctionId }` | Leave auction room |
| `ping` | `{}` | Health check |

#### Server → Client  

| Event | Payload | Description |
|-------|---------|-------------|
| `bid:new` | `{ bid, auction, timestamp }` | New bid placed |
| `auction:started` | `{ auction, message }` | Auction went live |
| `auction:ended` | `{ auction, winner }` | Auction ended |
| `viewer:joined` | `{ userId, viewerCount }` | User joined auction |
| `viewer:left` | `{ userId, viewerCount }` | User left auction |

### Real-time Architecture

- **Room-based**: Each auction has its own WebSocket room
- **Redis Locking**: Prevents race conditions during bidding
- **Automatic Reconnection**: Client reconnects and rejoins rooms
- **Live Viewer Count**: See how many users are watching

---

## Additional Resources

### Related Documentation

- [Sequelize ORM Guide](https://sequelize.org/docs/v6/)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Render Deployment Guide](https://render.com/docs)
- [cron-job.org Setup](https://cron-job.org/en/documentation/)

### Architecture Decisions

- **JWT over Sessions**: Stateless authentication for scalability
- **Redis Locking**: Prevents race conditions in high-traffic bidding
- **WebSocket Rooms**: Efficient real-time updates per auction
- **Multi-stage Docker**: Optimized build size and security

### Performance Considerations

- **Database Indexing**: UUIDs on all foreign keys
- **Redis Caching**: Auction status and highest bids
- **WebSocket Efficiency**: Room-based broadcasting
- **Build Optimization**: Tree-shaking and code splitting

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

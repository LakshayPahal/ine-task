import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import socket from '../api/socket';
import Countdown from '../components/Countdown';
import BidBox from '../components/BidBox';

export default function AuctionDetail() {
  const { id } = useParams();
  const [auction, setAuction] = useState(null);
  const [highest, setHighest] = useState(null);
  const [bidHistory, setBidHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [counterOffer, setCounterOffer] = useState(null);

  const getUserId = () => {
    let userId = localStorage.getItem('userId');
    if (userId && !userId.includes('-')) {
      localStorage.removeItem('userId');
      userId = null;
    }
    if (!userId) {
      userId = `temp_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('userId', userId);
    }
    return userId;
  };

  const deleteBid = async (bidId) => {
    if (!confirm('Are you sure you want to delete this bid?')) {
      return;
    }

    try {
      await api.delete(`/auctions/${id}/bid/${bidId}`);
      
      setBidHistory(prev => prev.filter(bid => bid.id !== bidId));
      
      if (window.addNotification) {
        window.addNotification('Bid deleted successfully!', 'success');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to delete bid';
      if (window.addNotification) {
        window.addNotification(errorMessage, 'error');
      }
    }
  };

  const loadCounterOffer = async () => {
    try {
      const response = await api.get(`/auctions/${id}/counter-offer`);
      setCounterOffer(response.data.counterOffer);
    } catch (error) {
      setCounterOffer(null);
    }
  };

  const respondToCounterOffer = async (action) => {
    const actionText = action === 'accept' ? 'accept' : 'reject';
    if (!confirm(`Are you sure you want to ${actionText} this counter offer?`)) {
      return;
    }

    try {
      await api.post(`/auctions/${id}/counter-offer/${action}`);
      
      if (window.addNotification) {
        window.addNotification(
          `Counter offer ${action}ed successfully!`, 
          action === 'accept' ? 'success' : 'info'
        );
      }
      
      loadAuctionData();
      loadCounterOffer();
    } catch (error) {
      const errorMessage = error.response?.data?.error || `Failed to ${actionText} counter offer`;
      if (window.addNotification) {
        window.addNotification(errorMessage, 'error');
      }
    }
  };

  useEffect(() => {
    loadAuctionData();
    loadCounterOffer();
  }, [id]);

  useEffect(() => {
    if (!auction) return;

    const userId = getUserId();
    socket.emit('joinAuction', { auctionId: id, userId });
    setConnectionStatus('connected');

    socket.on('auction:status', (data) => {
      console.log('Auction status:', data);
    });

    socket.on('bid:new', (data) => {
      console.log('New bid received:', data);
      
      if (data.auction?.currentHighest) {
        setHighest(data.auction.currentHighest);
      }
      
      setBidHistory(prev => [data.bid, ...prev.slice(0, 9)]);
      
      if (window.addNotification) {
        window.addNotification(
          `New bid: ₹${data.bid.amount} by ${data.bid.bidderName}`,
          'info'
        );
      }
    });

    socket.on('bid:outbid', (data) => {
      if (data.outbidUserId === userId) {
        if (window.addNotification) {
          window.addNotification(
            `You've been outbid! New leading bid: ₹${data.outbidBy?.amount}`,
            'warning'
          );
        }
      }
    });

    socket.on('auction:started', (data) => {
      setAuction(prev => ({ ...prev, status: 'live' }));
      if (window.addNotification) {
        window.addNotification(
          `Auction "${data.auction.title}" is now live!`,
          'success'
        );
      }
    });

    socket.on('auction:ended', (data) => {
      setAuction(prev => ({ ...prev, status: 'ended' }));
      if (window.addNotification) {
        window.addNotification(
          `Auction "${data.auction.title}" has ended!`,
          'info'
        );
      }
    });

    socket.on('seller:decision', (data) => {
      if (data.decision === 'ACCEPTED') {
        setAuction(prev => ({ ...prev, status: 'closed' }));
        if (window.addNotification) {
          window.addNotification(
            data.message,
            'success'
          );
        }
      } else if (data.decision === 'REJECTED') {
        setAuction(prev => ({ ...prev, status: 'ended' }));
        if (window.addNotification) {
          window.addNotification(
            data.message,
            'error'
          );
        }
      }
    });

    socket.on('auction:won', (data) => {
      if (window.addNotification) {
        window.addNotification(
          data.message,
          'success'
        );
      }
    });

    socket.on('bid:rejected', (data) => {
      if (window.addNotification) {
        window.addNotification(
          data.message,
          'error'
        );
      }
    });

    socket.on('viewer:joined', (data) => {
      setViewerCount(data.viewerCount);
    });

    socket.on('viewer:left', (data) => {
      setViewerCount(data.viewerCount);
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('connect', () => {
      setConnectionStatus('connected');
    });

    socket.on('counter-offer:made', (data) => {
      setAuction(prev => ({ ...prev, status: 'counter-offer' }));
      loadCounterOffer(); 
      
      if (window.addNotification) {
        window.addNotification(
          data.message,
          'info'
        );
      }
    });

    socket.on('counter-offer:received', (data) => {
      loadCounterOffer(); 
      
      if (window.addNotification) {
        window.addNotification(
          data.message,
          'warning'
        );
      }
    });

    socket.on('counter-offer:accepted', (data) => {
      setAuction(prev => ({ ...prev, status: 'closed' }));
      setCounterOffer(null); 
      
      if (window.addNotification) {
        window.addNotification(
          data.message,
          'success'
        );
      }
    });

    socket.on('counter-offer:rejected', (data) => {
      setAuction(prev => ({ ...prev, status: 'ended' }));
      setCounterOffer(null); 
      
      if (window.addNotification) {
        window.addNotification(
          data.message,
          'info'
        );
      }
    });

    socket.on('counter-offer:success', (data) => {
      if (window.addNotification) {
        window.addNotification(
          data.message,
          'success'
        );
      }
    });

    socket.on('counter-offer:buyer-accepted', (data) => {
      if (window.addNotification) {
        window.addNotification(
          data.message,
          'success'
        );
      }
    });

    socket.on('counter-offer:rejected-confirmed', (data) => {
      if (window.addNotification) {
        window.addNotification(
          data.message,
          'info'
        );
      }
    });

    socket.on('counter-offer:buyer-rejected', (data) => {
      if (window.addNotification) {
        window.addNotification(
          data.message,
          'error'
        );
      }
    });

    return () => {
      socket.emit('leaveAuction', { auctionId: id });
      socket.off('auction:status');
      socket.off('bid:new');
      socket.off('bid:outbid');
      socket.off('auction:started');
      socket.off('auction:ended');
      socket.off('seller:decision');
      socket.off('auction:won');
      socket.off('bid:rejected');
      socket.off('viewer:joined');
      socket.off('viewer:left');
      socket.off('disconnect');
      socket.off('connect');
      socket.off('counter-offer:made');
      socket.off('counter-offer:received');
      socket.off('counter-offer:accepted');
      socket.off('counter-offer:rejected');
      socket.off('counter-offer:success');
      socket.off('counter-offer:buyer-accepted');
      socket.off('counter-offer:rejected-confirmed');
      socket.off('counter-offer:buyer-rejected');
    };
  }, [id, auction]);

  const loadAuctionData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.get(`/auctions/${id}`);
      setAuction(response.data);
      setHighest(response.data.currentHighestBid);
    } catch (err) {
      setError('Failed to load auction details');
      console.error('Error loading auction:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(price);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'live': return '#28a745';
      case 'ended': return '#dc3545';
      case 'closed': return '#6f42c1';
      case 'scheduled': return '#6c757d';
      case 'counter-offer': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#28a745';
      case 'disconnected': return '#dc3545';
      default: return '#ffc107';
    }
  };

  if (loading) {
    return (
      <div style={{ 
        maxWidth: '800px', 
        margin: '2rem auto', 
        padding: '2rem',
        textAlign: 'center'
      }}>
        Loading auction details...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        maxWidth: '800px', 
        margin: '2rem auto', 
        padding: '2rem'
      }}>
        <div style={{
          padding: '1rem',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
        <Link to="/" style={{ color: '#007bff' }}>← Back to Home</Link>
      </div>
    );
  }

  if (!auction) {
    return (
      <div style={{ 
        maxWidth: '800px', 
        margin: '2rem auto', 
        padding: '2rem',
        textAlign: 'center'
      }}>
        Auction not found
        <div style={{ marginTop: '1rem' }}>
          <Link to="/" style={{ color: '#007bff' }}>← Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '2rem',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link to="/" style={{ color: '#007bff', textDecoration: 'none' }}>
          ← Back to Home
        </Link>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.5rem 1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        marginBottom: '1rem',
        fontSize: '0.9rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            backgroundColor: getConnectionStatusColor()
          }}></span>
          {connectionStatus === 'connected' ? 'Live Updates Active' : 'Connecting...'}
        </div>
        {viewerCount > 0 && (
          <div>👥 {viewerCount} viewer{viewerCount !== 1 ? 's' : ''}</div>
        )}
      </div>

      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          marginBottom: '1rem'
        }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>{auction.title}</h1>
          <div style={{
            padding: '4px 12px',
            borderRadius: '4px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            color: 'white',
            backgroundColor: getStatusColor(auction.status)
          }}>
            {auction.status.toUpperCase()}
          </div>
        </div>

        <p style={{ color: '#666', margin: '1rem 0' }}>
          {auction.description}
        </p>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginTop: '1rem'
        }}>
          <div>
            <strong>Starting Price:</strong><br />
            {formatPrice(auction.startingPrice)}
          </div>
          <div>
            <strong>Bid Increment:</strong><br />
            {formatPrice(auction.bidIncrement)}
          </div>
          <div>
            <strong>Seller:</strong><br />
            {auction.seller?.displayName || 'Anonymous'}
          </div>
        </div>

        {auction.status === 'live' && (
          <div style={{ marginTop: '1rem' }}>
            <Countdown 
              endAt={auction.endAt} 
              onComplete={() => setAuction(prev => ({ ...prev, status: 'ended' }))}
            />
          </div>
        )}
      </div>

      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        textAlign: 'center'
      }}>
        <h2 style={{ margin: '0 0 1rem 0' }}>Current Highest Bid</h2>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#007bff' }}>
          {formatPrice(highest?.amount || auction.startingPrice)}
        </div>
        {highest && (
          <div style={{ color: '#666', marginTop: '0.5rem' }}>
            by {highest.displayName} • {new Date(highest.at).toLocaleString()}
          </div>
        )}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <BidBox 
          auctionId={id} 
          highest={highest} 
          increment={auction.bidIncrement}
          auction={auction}
        />
      </div>

      {counterOffer && counterOffer.buyerId === getUserId() && counterOffer.status === 'pending' && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ 
            margin: '0 0 1rem 0', 
            color: '#856404',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            Counter Offer Received!
          </h3>
          
          <div style={{
            backgroundColor: 'white',
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '1rem'
          }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Your Original Bid:</strong> ₹{counterOffer.originalBid?.toLocaleString('en-IN')}
            </div>
            <div style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>
              <strong>Seller's Counter Offer:</strong> 
              <span style={{ color: '#007bff', fontWeight: 'bold', marginLeft: '0.5rem' }}>
                ₹{counterOffer.counterOfferAmount?.toLocaleString('en-IN')}
              </span>
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              <strong>Expires:</strong> {new Date(counterOffer.expiresAt).toLocaleString()}
            </div>
          </div>

          <div style={{
            backgroundColor: '#fff3cd',
            padding: '0.75rem',
            borderRadius: '4px',
            marginBottom: '1rem',
            fontSize: '0.9rem',
            color: '#856404'
          }}>
            The seller has proposed a different price. You can accept or reject this counter offer.
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => respondToCounterOffer('accept')}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#218838'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#28a745'}
            >
              Accept Counter Offer
            </button>
            <button
              onClick={() => respondToCounterOffer('reject')}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
            >
              Reject Counter Offer
            </button>
          </div>
        </div>
      )}

      {counterOffer && counterOffer.buyerId !== getUserId() && auction?.status === 'counter-offer' && (
        <div style={{
          backgroundColor: '#e3f2fd',
          border: '1px solid #2196f3',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
          textAlign: 'center'
        }}>
          <div style={{ color: '#1976d2', fontWeight: 'bold' }}>
            Counter offer pending buyer response
          </div>
          <div style={{ fontSize: '0.9rem', color: '#1565c0', marginTop: '0.5rem' }}>
            Seller proposed: ₹{counterOffer.counterOfferAmount?.toLocaleString('en-IN')}
          </div>
        </div>
      )}

      {bidHistory.length > 0 && (
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '1.5rem'
        }}>
          <h3 style={{ margin: '0 0 1rem 0' }}>Recent Bids</h3>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {bidHistory.map((bid, index) => {
              const isMyBid = bid.bidderId === getUserId();
              const isHighestBid = highest && bid.id === highest.bidId;
              
              return (
                <div 
                  key={bid.id || index}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0',
                    borderBottom: index < bidHistory.length - 1 ? '1px solid #eee' : 'none',
                    backgroundColor: isMyBid ? '#f0f8ff' : 'transparent'
                  }}
                >
                  <div>
                    <strong>{formatPrice(bid.amount)}</strong>
                    <span style={{ color: '#666', marginLeft: '0.5rem' }}>
                      by {bid.bidderName}
                      {isMyBid && (
                        <span style={{ 
                          color: '#007bff', 
                          fontWeight: 'bold',
                          marginLeft: '0.25rem' 
                        }}>
                          (You)
                        </span>
                      )}
                      {isHighestBid && (
                        <span style={{ 
                          color: '#28a745', 
                          fontWeight: 'bold',
                          marginLeft: '0.25rem' 
                        }}>
                          (Highest)
                        </span>
                      )}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#666', fontSize: '0.8rem' }}>
                      {new Date(bid.createdAt).toLocaleTimeString()}
                    </span>
                    {isMyBid && !isHighestBid && auction?.status === 'live' && (
                      <button
                        onClick={() => deleteBid(bid.id)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '0.7rem',
                          cursor: 'pointer'
                        }}
                        title="Delete your bid"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
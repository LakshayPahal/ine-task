import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import dayjs from 'dayjs';
import RequireAuth from '../components/RequireAuth';

export default function SellerConsole() {
  const [form, setForm] = useState({
    sellerId: '',
    title: '',
    description: '',
    startingPrice: '',
    bidIncrement: '',
    startAt: '',
    endAt: ''
  });
  const [myAuctions, setMyAuctions] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [counterOfferAmount, setCounterOfferAmount] = useState('');
  const [showCounterOfferFor, setShowCounterOfferFor] = useState(null);

  const getUserId = () => localStorage.getItem('userId');

  const createUserIfNeeded = async () => {
    let userId = localStorage.getItem('userId');
    
    if (userId && !userId.includes('-')) {
      localStorage.removeItem('userId');
      userId = null;
    }
    
    if (!userId) {
      try {
        const response = await api.post('/users/guest', {
          displayName: `Seller ${Math.random().toString(36).substr(2, 6)}`,
          email: `seller_${Math.random().toString(36).substr(2, 6)}@example.com`
        });
        
        userId = response.data.id;
        localStorage.setItem('userId', userId);
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
        }
        console.log('Created new user:', userId);
      } catch (error) {
        console.error('Failed to create user:', error);
        throw new Error('Failed to create user. Please try again.');
      }
    }
    
    return userId;
  };

  useEffect(() => {
    const initializeUser = async () => {
      const userId = await createUserIfNeeded();
      setForm(prev => ({ ...prev, sellerId: userId }));
      
      const now = dayjs();
      const start = now.add(1, 'hour');
      const end = start.add(24, 'hours');
      
      setForm(prev => ({
        ...prev,
        startAt: start.format('YYYY-MM-DDTHH:mm'),
        endAt: end.format('YYYY-MM-DDTHH:mm')
      }));

      loadMyAuctions();
    };

    initializeUser();
  }, []);

  const loadMyAuctions = async () => {
    try {
      setLoading(true);
      const userId = getUserId();

      const [liveResponse, scheduledResponse, endedResponse] = await Promise.all([
        api.get('/auctions?status=live'),
        api.get('/auctions?status=scheduled'),
        api.get('/auctions?status=ended')
      ]);
      
      const allAuctions = [
        ...(liveResponse.data.auctions || []),
        ...(scheduledResponse.data.auctions || []),
        ...(endedResponse.data.auctions || [])
      ];
      const sellerAuctions = allAuctions.filter(a => a.sellerId === userId);
      
      setMyAuctions(sellerAuctions);
    } catch (err) {
      console.error('Error loading auctions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setCreateError('');
  };

  const validateForm = () => {
    if (!form.title.trim()) return 'Title is required';
    if (!form.description.trim()) return 'Description is required';
    if (!form.startingPrice || form.startingPrice <= 0) return 'Valid starting price is required';
    if (!form.bidIncrement || form.bidIncrement <= 0) return 'Valid bid increment is required';
    if (!form.startAt) return 'Start time is required';
    if (!form.endAt) return 'End time is required';
    
    const start = dayjs(form.startAt);
    const end = dayjs(form.endAt);
    const now = dayjs();
    
    if (start.isBefore(now)) return 'Start time must be in the future';
    if (end.isBefore(start)) return 'End time must be after start time';
    if (end.diff(start, 'minutes') < 30) return 'Auction must run for at least 30 minutes';
    
    return null;
  };

  const createAuction = async () => {
    const validationError = validateForm();
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    setIsCreating(true);
    setCreateError('');
    setCreateSuccess('');

    try {
      const auctionData = {
        ...form,
        startingPrice: parseFloat(form.startingPrice),
        bidIncrement: parseFloat(form.bidIncrement)
      };

      await api.post('/auctions', auctionData);
      
      setCreateSuccess('Auction created successfully!');
      
      const userId = getUserId();
      const now = dayjs();
      const start = now.add(1, 'hour');
      const end = start.add(24, 'hours');
      
      setForm({
        sellerId: userId,
        title: '',
        description: '',
        startingPrice: '',
        bidIncrement: '',
        startAt: start.format('YYYY-MM-DDTHH:mm'),
        endAt: end.format('YYYY-MM-DDTHH:mm')
      });

      loadMyAuctions();

      setTimeout(() => setCreateSuccess(''), 5000);

    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to create auction';
      setCreateError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleAuctionAction = async (auctionId, action) => {
    try {
      await api.post(`/auctions/${auctionId}/${action}`, {
        sellerId: getUserId()
      });
      
      if (window.addNotification) {
        window.addNotification(
          `Auction ${action}ed successfully!`,
          'success'
        );
      }

      loadMyAuctions();
    } catch (err) {
      const errorMessage = err.response?.data?.error || `Failed to ${action} auction`;
      if (window.addNotification) {
        window.addNotification(errorMessage, 'error');
      }
    }
  };

  const deleteAuction = async (auctionId) => {
    if (!confirm('Are you sure you want to delete this auction? This will permanently remove the auction and all its bids. This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/auctions/${auctionId}`, {
        data: { sellerId: getUserId() }
      });
      
      if (window.addNotification) {
        window.addNotification('Auction deleted successfully!', 'success');
      }

      loadMyAuctions();
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to delete auction';
      if (window.addNotification) {
        window.addNotification(errorMessage, 'error');
      }
    }
  };

  const makeCounterOffer = async (auctionId) => {
    if (!counterOfferAmount || parseFloat(counterOfferAmount) <= 0) {
      if (window.addNotification) {
        window.addNotification('Please enter a valid counter offer amount', 'error');
      }
      return;
    }

    try {
      await api.post(`/auctions/${auctionId}/counter-offer`, {
        sellerId: getUserId(),
        counterOfferAmount: parseFloat(counterOfferAmount)
      });
      
      if (window.addNotification) {
        window.addNotification('Counter offer sent successfully!', 'success');
      }
      
      setShowCounterOfferFor(null);
      setCounterOfferAmount('');
      loadMyAuctions();
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to send counter offer';
      if (window.addNotification) {
        window.addNotification(errorMessage, 'error');
      }
    }
  };

  const showCounterOfferForm = (auctionId) => {
    setShowCounterOfferFor(auctionId);
    setCounterOfferAmount('');
  };

  const cancelCounterOffer = () => {
    setShowCounterOfferFor(null);
    setCounterOfferAmount('');
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

  return (
    <RequireAuth fallback={
      <div style={{ 
        maxWidth: '600px', 
        margin: '2rem auto', 
        padding: '2rem',
        textAlign: 'center',
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '8px'
      }}>
        <h1 style={{ color: '#495057', marginBottom: '1rem' }}>Seller Console</h1>
        <p style={{ color: '#6c757d', marginBottom: '2rem' }}>
          Please sign in to create and manage your auctions
        </p>
        <Link to="/" style={{ 
          color: '#007bff', 
          textDecoration: 'none',
          padding: '0.5rem 1rem',
          border: '1px solid #007bff',
          borderRadius: '4px',
          display: 'inline-block'
        }}>
          ← Back to Home
        </Link>
      </div>
    }>
      <div style={{ 
        maxWidth: '1000px', 
        margin: '0 auto', 
        padding: '2rem',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '2rem'
        }}>
          <h1 style={{ margin: 0 }}>Seller Console</h1>
          <Link to="/" style={{ color: '#007bff', textDecoration: 'none' }}>
            ← Back to Home
          </Link>
        </div>

      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <h2 style={{ margin: '0 0 1.5rem 0' }}>Create New Auction</h2>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1rem'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Title *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="e.g., Vintage Guitar"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Starting Price (₹) *
            </label>
            <input
              type="number"
              value={form.startingPrice}
              onChange={(e) => handleInputChange('startingPrice', e.target.value)}
              placeholder="1000"
              min="1"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Bid Increment (₹) *
            </label>
            <input
              type="number"
              value={form.bidIncrement}
              onChange={(e) => handleInputChange('bidIncrement', e.target.value)}
              placeholder="50"
              min="1"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Start Time *
            </label>
            <input
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => handleInputChange('startAt', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              End Time *
            </label>
            <input
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => handleInputChange('endAt', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Description *
          </label>
          <textarea
            value={form.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Detailed description of the item..."
            rows="4"
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              resize: 'vertical'
            }}
          />
        </div>

        {createError && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            border: '1px solid #f5c6cb',
            borderRadius: '4px'
          }}>
            {createError}
          </div>
        )}

        {createSuccess && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#d4edda',
            color: '#155724',
            border: '1px solid #c3e6cb',
            borderRadius: '4px'
          }}>
            {createSuccess}
          </div>
        )}

        <button
          onClick={createAuction}
          disabled={isCreating}
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: isCreating ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: isCreating ? 'not-allowed' : 'pointer'
          }}
        >
          {isCreating ? 'Creating...' : 'Create Auction'}
        </button>
      </div>
      
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1.5rem'
      }}>
        <h2 style={{ margin: '0 0 1.5rem 0' }}>
          My Auctions ({myAuctions.length})
        </h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            Loading your auctions...
          </div>
        ) : myAuctions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            You haven't created any auctions yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {myAuctions.map(auction => (
              <div 
                key={auction.id}
                style={{
                  border: '1px solid #eee',
                  borderRadius: '4px',
                  padding: '1rem',
                  backgroundColor: '#f8f9fa'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: '0.5rem'
                }}>
                  <h4 style={{ margin: 0 }}>{auction.title}</h4>
                  <div style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    color: 'white',
                    backgroundColor: getStatusColor(auction.status)
                  }}>
                    {auction.status.toUpperCase()}
                  </div>
                </div>

                <p style={{ color: '#666', margin: '0.5rem 0', fontSize: '0.9rem' }}>
                  {auction.description}
                </p>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '1rem',
                  margin: '0.5rem 0',
                  fontSize: '0.8rem'
                }}>
                  <div>
                    <strong>Starting:</strong> {formatPrice(auction.startingPrice)}
                  </div>
                  <div>
                    <strong>Increment:</strong> {formatPrice(auction.bidIncrement)}
                  </div>
                  <div>
                    <strong>Starts:</strong> {dayjs(auction.startAt).format('MMM D, HH:mm')}
                  </div>
                  <div>
                    <strong>Ends:</strong> {dayjs(auction.endAt).format('MMM D, HH:mm')}
                  </div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  gap: '0.5rem', 
                  marginTop: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <Link 
                    to={`/auction/${auction.id}`}
                    style={{
                      padding: '0.25rem 0.75rem',
                      backgroundColor: '#007bff',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '3px',
                      fontSize: '0.8rem'
                    }}
                  >
                    View Details
                  </Link>

                  <button
                    onClick={() => deleteAuction(auction.id)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                    title="Delete this auction"
                  >
                    Delete
                  </button>

                  {auction.status === 'ended' && (
                    <>
                      <button
                        onClick={() => handleAuctionAction(auction.id, 'accept')}
                        style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        Accept Bid
                      </button>
                      <button
                        onClick={() => showCounterOfferForm(auction.id)}
                        style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        Counter Offer
                      </button>
                      <button
                        onClick={() => handleAuctionAction(auction.id, 'reject')}
                        style={{
                          padding: '0.25rem 0.75rem',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        Reject All
                      </button>
                    </>
                  )}

                  {auction.status === 'counter-offer' && (
                    <div style={{
                      padding: '0.5rem',
                      backgroundColor: '#fff3cd',
                      borderRadius: '4px',
                      border: '1px solid #ffc107',
                      fontSize: '0.8rem',
                      color: '#856404'
                    }}>
                      ⏰ Counter offer pending buyer response
                    </div>
                  )}

                  {/* Counter Offer Form */}
                  {showCounterOfferFor === auction.id && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '1rem',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                      border: '1px solid #dee2e6'
                    }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                        Make Counter Offer
                      </h4>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="number"
                          value={counterOfferAmount}
                          onChange={(e) => setCounterOfferAmount(e.target.value)}
                          placeholder="Enter counter offer amount"
                          style={{
                            flex: 1,
                            padding: '0.25rem 0.5rem',
                            border: '1px solid #ddd',
                            borderRadius: '3px',
                            fontSize: '0.8rem'
                          }}
                        />
                        <button
                          onClick={() => makeCounterOffer(auction.id)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          Send
                        </button>
                        <button
                          onClick={cancelCounterOffer}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </RequireAuth>
  );
}
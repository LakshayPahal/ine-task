import { useEffect, useState } from 'react';
import { RefreshCw, Search, Filter, TrendingUp, Zap, Calendar, Archive } from 'lucide-react';
import api from '../api/axios';
import socket from '../api/socket';
import AuctionCard from '../components/AuctionCard';

export default function Home() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('live');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadAuctions();
  }, [filter]);

  useEffect(() => {
    socket.on('auction:system:started', (data) => {
      if (window.addNotification) {
        window.addNotification(
          `New auction started: "${data.title}"`,
          'info'
        );
      }
      if (filter === 'live') {
        loadAuctions();
      }
    });

    socket.on('auction:system:ended', (data) => {
      if (window.addNotification) {
        window.addNotification(
          `Auction ended: "${data.title}"`,
          'info'
        );
      }
      loadAuctions();
    });

    return () => {
      socket.off('auction:system:started');
      socket.off('auction:system:ended');
    };
  }, [filter]);

  const loadAuctions = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.get(`/auctions?status=${filter}`);
      setAuctions(response.data.auctions || []);
    } catch (err) {
      setError('Failed to load auctions. Please try again.');
      console.error('Error loading auctions:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterOptions = [
    { 
      value: 'live', 
      label: 'Live Auctions', 
      icon: Zap,
      color: 'text-success-600'
    },
    { 
      value: 'scheduled', 
      label: 'Upcoming', 
      icon: Calendar,
      color: 'text-slate-600'
    },
    { 
      value: 'ended', 
      label: 'Ended', 
      icon: Archive,
      color: 'text-danger-600'
    },
    { 
      value: 'closed', 
      label: 'Sold', 
      icon: TrendingUp,
      color: 'text-primary-600'
    }
  ];

  const filteredAuctions = auctions.filter(auction =>
    auction.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    auction.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentFilterOption = filterOptions.find(opt => opt.value === filter);

  return (
    <div className="container py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          Discover Amazing Auctions
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
          Join live auctions, place bids, and win unique items from sellers worldwide.
        </p>
      </div>

      <div className="mb-8">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search auctions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === option.value
                      ? 'bg-primary-100 text-primary-700 border border-primary-200'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${filter === option.value ? 'text-primary-600' : option.color}`} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="loading-spinner mb-4"></div>
            <p className="text-slate-600">Loading auctions...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-5 w-5 text-danger-400">⚠️</div>
              </div>
              <div className="ml-3">
                <p className="text-sm text-danger-800">{error}</p>
              </div>
            </div>
            <button 
              onClick={loadAuctions}
              className="btn btn-danger btn-sm"
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          {(searchTerm || auctions.length > 0) && (
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                {currentFilterOption && (
                  <currentFilterOption.icon className={`h-5 w-5 ${currentFilterOption.color}`} />
                )}
                <h2 className="text-xl font-semibold text-slate-900">
                  {currentFilterOption?.label || 'Auctions'}
                  {searchTerm && ` matching "${searchTerm}"`}
                </h2>
              </div>
              
              {filteredAuctions.length > 0 && (
                <span className="text-sm text-slate-500">
                  {filteredAuctions.length} result{filteredAuctions.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {filteredAuctions.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto max-w-md">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-6">
                  <Filter className="h-8 w-8 text-slate-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {searchTerm ? 'No matching auctions found' : `No ${filter} auctions found`}
                </h3>
                <p className="text-slate-600 mb-6">
                  {searchTerm 
                    ? 'Try adjusting your search terms or browse all auctions.'
                    : filter === 'live' 
                      ? 'There are no live auctions at the moment. Check back soon!'
                      : `No ${filter} auctions available right now.`
                  }
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="btn btn-secondary btn-md"
                    >
                      Clear search
                    </button>
                  )}
                  {filter !== 'live' && (
                    <button 
                      onClick={() => setFilter('live')}
                      className="btn btn-primary btn-md"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      View Live Auctions
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="auction-grid">
              {filteredAuctions.map(auction => (
                <AuctionCard key={auction.id} auction={auction} />
              ))}
            </div>
          )}
        </>
      )}
    
      {!loading && !error && filter === 'live' && filteredAuctions.length > 0 && (
        <div className="mt-12 bg-gradient-to-r from-primary-50 to-success-50 rounded-xl p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              🔥 Live Auction Activity
            </h3>
            <p className="text-slate-600">
              {filteredAuctions.length} auction{filteredAuctions.length !== 1 ? 's' : ''} currently live • 
              Join the excitement and place your bids now!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
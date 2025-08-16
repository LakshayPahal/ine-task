import { Link } from 'react-router-dom';
import { Clock, Eye, Gavel, TrendingUp, Calendar } from 'lucide-react';
import Countdown from './Countdown';

export default function AuctionCard({ auction }) {
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(price);
  };

  const getBadgeClass = (status) => {
    const classes = {
      scheduled: 'badge-scheduled',
      live: 'badge-live',
      ended: 'badge-ended',
      closed: 'badge-closed'
    };
    return classes[status] || 'badge-scheduled';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'live':
        return <Gavel className="h-3 w-3" />;
      case 'scheduled':
        return <Calendar className="h-3 w-3" />;
      case 'ended':
        return <Clock className="h-3 w-3" />;
      case 'closed':
        return <TrendingUp className="h-3 w-3" />;
      default:
        return <Eye className="h-3 w-3" />;
    }
  };

  return (
    <div className="card group hover:scale-[1.02] transition-transform duration-200">
      <div className="card-content">
        <div className={`${getBadgeClass(auction.status)} mb-4 flex items-center gap-1`}>
          {getStatusIcon(auction.status)}
          <span className="uppercase text-xs font-semibold tracking-wide">
            {auction.status}
          </span>
          {auction.status === 'live' && (
            <div className="auction-status-pulse ml-1 h-2 w-2 rounded-full bg-success-500"></div>
          )}
        </div>

        <h3 className="text-lg font-semibold text-slate-900 mb-2 line-clamp-2">
          {auction.title}
        </h3>
        
        <p className="text-slate-600 text-sm mb-4 line-clamp-2">
          {auction.description}
        </p>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">Starting Price</span>
            <span className="font-semibold text-slate-900">
              {formatPrice(auction.startingPrice)}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">Bid Increment</span>
            <span className="font-medium text-slate-700">
              {formatPrice(auction.bidIncrement)}
            </span>
          </div>
        </div>

        {auction.currentBid && (
          <div className="bg-primary-50 rounded-lg p-3 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-primary-700">Current Bid</span>
              <span className="text-lg font-bold text-primary-900">
                {formatPrice(auction.currentBid)}
              </span>
            </div>
          </div>
        )}

        {auction.status === 'live' && (
          <div className="bg-success-50 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-success-700">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Time Remaining</span>
            </div>
            <div className="mt-1">
              <Countdown endAt={auction.endAt} />
            </div>
          </div>
        )}

        {auction.status === 'scheduled' && auction.startAt && (
          <div className="bg-slate-50 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="h-4 w-4" />
              <span className="text-sm font-medium">Starts At</span>
            </div>
            <div className="mt-1 text-sm text-slate-700">
              {new Date(auction.startAt).toLocaleString()}
            </div>
          </div>
        )}
      </div>

      <div className="card-footer">
        <Link 
          to={`/auction/${auction.id}`}
          className={`w-full justify-center ${
            auction.status === 'live' 
              ? 'btn btn-primary btn-md' 
              : 'btn btn-secondary btn-md'
          }`}
        >
          {auction.status === 'live' && <Gavel className="h-4 w-4 mr-2" />}
          {auction.status === 'live' ? 'Join Auction' : 'View Details'}
        </Link>
      </div>
    </div>
  );
}
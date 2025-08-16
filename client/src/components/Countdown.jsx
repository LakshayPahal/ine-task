import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(duration);
dayjs.extend(relativeTime);

export default function Countdown({ endAt, onComplete, variant = 'default' }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);
  const [urgency, setUrgency] = useState('normal');

  useEffect(() => {
    const updateTimer = () => {
      const now = dayjs();
      const end = dayjs(endAt);
      const diff = end.diff(now);

      if (diff <= 0) {
        setIsExpired(true);
        if (onComplete) onComplete();
        return;
      }

      const duration = dayjs.duration(diff);
      const days = Math.floor(duration.asDays());
      const hours = duration.hours();
      const minutes = duration.minutes();
      const seconds = duration.seconds();

      setTimeLeft({ days, hours, minutes, seconds });

      const totalMinutes = duration.asMinutes();
      if (totalMinutes < 5) {
        setUrgency('critical');
      } else if (totalMinutes < 30) {
        setUrgency('warning');
      } else {
        setUrgency('normal');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endAt, onComplete]);

  const getUrgencyClasses = () => {
    switch (urgency) {
      case 'critical':
        return 'text-danger-700 bg-danger-50 border-danger-200';
      case 'warning':
        return 'text-warning-700 bg-warning-50 border-warning-200';
      default:
        return 'text-success-700 bg-success-50 border-success-200';
    }
  };

  const getIcon = () => {
    if (isExpired) return <CheckCircle className="h-4 w-4" />;
    if (urgency === 'critical') return <AlertTriangle className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  if (variant === 'compact') {
    if (isExpired) {
      return (
        <span className="text-xs font-medium text-danger-600">
          Ended
        </span>
      );
    }

    const { days, hours, minutes, seconds } = timeLeft;
    let display = '';
    
    if (days > 0) display = `${days}d ${hours}h`;
    else if (hours > 0) display = `${hours}h ${minutes}m`;
    else if (minutes > 0) display = `${minutes}m ${seconds}s`;
    else display = `${seconds}s`;

    return (
      <span className={`text-xs font-medium ${urgency === 'critical' ? 'text-danger-600' : urgency === 'warning' ? 'text-warning-600' : 'text-success-600'}`}>
        {display}
      </span>
    );
  }

  if (isExpired) {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-danger-700">
        <CheckCircle className="h-4 w-4" />
        <span>Auction Ended</span>
      </div>
    );
  }

  const { days, hours, minutes, seconds } = timeLeft;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getUrgencyClasses()}`}>
      {getIcon()}
      <div className="flex items-center gap-2 text-sm font-medium">
        {days > 0 && (
          <div className="text-center">
            <div className="font-bold text-lg leading-none">{days}</div>
            <div className="text-xs opacity-75">day{days !== 1 ? 's' : ''}</div>
          </div>
        )}
        
        {(days > 0 || hours > 0) && (
          <>
            {days > 0 && <span className="opacity-50">:</span>}
            <div className="text-center">
              <div className="font-bold text-lg leading-none">{hours.toString().padStart(2, '0')}</div>
              <div className="text-xs opacity-75">hr{hours !== 1 ? 's' : ''}</div>
            </div>
          </>
        )}
        
        <span className="opacity-50">:</span>
        <div className="text-center">
          <div className="font-bold text-lg leading-none">{minutes.toString().padStart(2, '0')}</div>
          <div className="text-xs opacity-75">min</div>
        </div>
        
        <span className="opacity-50">:</span>
        <div className="text-center">
          <div className="font-bold text-lg leading-none">{seconds.toString().padStart(2, '0')}</div>
          <div className="text-xs opacity-75">sec</div>
        </div>
      </div>
    </div>
  );
}
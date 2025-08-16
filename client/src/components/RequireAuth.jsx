import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import Login from './Login';

export default function RequireAuth({ children, fallback = null }) {
  const { isAuthenticated, login } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (isAuthenticated) {
    return children;
  }

  if (fallback) {
    return fallback;
  }

  return (
    <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <p className="text-gray-700 mb-3">Please sign in to bid on auctions</p>
      <button
        onClick={() => setShowLogin(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Sign In to Bid
      </button>
      
      {showLogin && (
        <Login
          onLogin={(userData) => {
            login(userData);
            setShowLogin(false);
            window.addNotification?.(`Welcome, ${userData.displayName}!`, 'success');
          }}
        />
      )}
    </div>
  );
}
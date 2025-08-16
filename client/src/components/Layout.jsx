import { Link, useLocation } from 'react-router-dom';
import { Gavel, Plus, Home, Bell } from 'lucide-react';
import { useState, useEffect } from 'react';
import Login from './Login';

export default function Layout({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  
  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  useEffect(() => {
    const handleNewNotification = (message, type = 'info') => {
      const notification = {
        id: Date.now() + Math.random(),
        message,
        type,
        timestamp: new Date()
      };
      setNotifications(prev => [notification, ...prev.slice(0, 9)]);
    };

    window.addNotification = handleNewNotification;
    return () => {
      delete window.addNotification;
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const displayName = localStorage.getItem('displayName');
    
    if (token && userId && displayName) {
      setUser({ token, userId, displayName });
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.notification-dropdown')) {
        setShowNotificationDropdown(false);
      }
    };

    if (showNotificationDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showNotificationDropdown]);

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col min-h-screen">  
        <header className="bg-white shadow-md border-b border-gray-200 relative">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center space-x-2 text-2xl font-bold text-blue-600">
                <Gavel className="h-8 w-8" />
                <span>Auction Platform</span>
              </Link>
              
              <nav className="flex items-center space-x-6">
                <Link
                  to="/"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors duration-200 ${
                    isActive('/') 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <Home className="h-4 w-4" />
                  <span>Home</span>
                </Link>
                
                <Link
                  to="/seller"
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors duration-200 ${
                    isActive('/seller') 
                      ? 'bg-green-100 text-green-700' 
                      : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  <span>Sell</span>
                </Link>
              </nav>

              <div className="flex items-center space-x-4">
                <div className="relative">
                  <button 
                    onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                    className="relative p-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors duration-200"
                    title="Notifications"
                  >
                    <Bell className="h-5 w-5" />
                    {notifications.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {notifications.length > 9 ? '9+' : notifications.length}
                      </span>
                    )}
                  </button>
                  
                  {showNotificationDropdown && (
                    <div className="notification-dropdown absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg w-80 max-h-96 overflow-y-auto z-50">
                      <div className="p-3 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-800">Notifications</h3>
                        {notifications.length > 0 && (
                          <button
                            onClick={() => setNotifications([])}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                      
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          No notifications
                        </div>
                      ) : (
                        <div className="max-h-64 overflow-y-auto">
                          {notifications.map((notification) => (
                            <div
                              key={notification.id}
                              className="p-3 border-b border-gray-100 hover:bg-gray-50 flex justify-between items-start"
                            >
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span>{getNotificationIcon(notification.type)}</span>
                                  <span className="text-sm text-gray-800">{notification.message}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {notification.timestamp.toLocaleTimeString()}
                                </div>
                              </div>
                              <button
                                onClick={() => removeNotification(notification.id)}
                                className="text-gray-400 hover:text-gray-600 ml-2"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {user ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                      {user.displayName}
                    </span>
                    <button
                      onClick={() => {
                        localStorage.removeItem('token');
                        localStorage.removeItem('userId');
                        localStorage.removeItem('displayName');
                        setUser(null);
                        window.addNotification?.('Signed out', 'info');
                      }}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowLogin(true)}
                    className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Sign In
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 py-8">
          {children}
        </main>

        <footer className="bg-white shadow-inner border-t border-gray-200 mt-auto py-6">
          <div className="container mx-auto px-4 text-center text-gray-600">
            <p>&copy; 2024 Auction Platform. All rights reserved.</p>
          </div>
        </footer>
      </div>
      
      {showLogin && (
        <Login
          onLogin={(userData) => {
            setUser(userData);
            setShowLogin(false);
            window.addNotification?.(`Welcome, ${userData.displayName}!`, 'success');
          }}
        />
      )}
    </div>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, PlusCircle, ListChecks, ShoppingBag, Users,
  Bell, Menu, X, MessageSquare, Settings, LogOut,
  ChevronDown, UserCircle
} from 'lucide-react';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef(null);
  const profileRef = useRef(null);

  // Fetch notifications from backend
  useEffect(() => {
    let isMounted = true;
    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications');
        if (!res.ok) throw new Error('Failed to fetch notifications');
        const data = await res.json();
        if (isMounted) {
          setNotifications(data);
          setUnreadCount(data.filter(n => !n.read).length);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // Poll every 10s
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Handle scroll and resize events
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth > 768) setIsMenuOpen(false);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Control body scrolling for mobile menu
  useEffect(() => {
    if (isMenuOpen && windowWidth <= 768) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [isMenuOpen, windowWidth]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        notificationRef.current && !notificationRef.current.contains(e.target) &&
        profileRef.current && !profileRef.current.contains(e.target)
      ) {
        setIsNotificationOpen(false);
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const isActive = (path) => location.pathname === path;

  const toggleMenu = () => {
    setIsMenuOpen(prev => !prev);
    setIsNotificationOpen(false);
    setIsProfileOpen(false);
  };

  const toggleNotifications = (e) => {
    e.stopPropagation();
    setIsNotificationOpen(prev => !prev);
    setIsProfileOpen(false);
  };

  const toggleProfile = (e) => {
    e.stopPropagation();
    setIsProfileOpen(prev => !prev);
    setIsNotificationOpen(false);
  };

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.removeItem('ksp_username');
    navigate('/login', { replace: true });
  };

  const closeMenuOnClick = () => {
    if (windowWidth <= 768) setIsMenuOpen(false);
  };

  const getDropdownPosition = () => {
    if (windowWidth <= 640) return { top: '48px', right: '8px' };
    if (windowWidth <= 768) return { top: '44px', right: '8px' };
    return { top: '40px', right: '0' };
  };

  return (
    <>
      {isMenuOpen && windowWidth <= 768 && (
        <div
          className="fixed inset-0 bg-indigo-900/50 backdrop-blur-sm z-40"
          onClick={toggleMenu}
          aria-hidden="true"
        />
      )}

      <nav className={`fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md transition-all duration-300 shadow-sm ${
        scrolled ? 'py-2' : 'py-3'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center space-x-2 py-1">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-md transition-transform hover:scale-105">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
                KSP Admin
              </span>
            </Link>

            <button
              className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={toggleMenu}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <div
              className={`fixed md:static top-0 left-0 bottom-0 w-80 md:w-auto bg-white md:bg-transparent z-50 flex flex-col md:flex-row md:items-center transition-transform duration-300 ease-in-out ${
                isMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
              } md:visible md:opacity-100 h-full md:h-auto shadow-xl md:shadow-none`}
              style={{ visibility: windowWidth <= 768 && !isMenuOpen ? 'hidden' : 'visible' }}
            >
              <div className="flex items-center justify-between p-4 md:hidden border-b border-gray-100">
                <Link to="/" className="flex items-center space-x-2" onClick={closeMenuOnClick}>
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 text-white">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <span className="text-lg font-bold text-gray-900">KSP Admin</span>
                </Link>
              </div>

              <ul className="flex flex-col md:flex-row md:space-x-2 px-4 md:px-0 py-4 md:py-0 space-y-2 md:space-y-0">
                {[
                  { path: '/', label: 'Dashboard', Icon: Home },
                  { path: '/add-product', label: 'Add Product', Icon: PlusCircle },
                  { path: '/manage-products', label: 'Products', Icon: ListChecks },
                  { path: '/orders', label: 'Orders', Icon: ShoppingBag },
                  { path: '/users', label: 'Users', Icon: Users },
                  { path: '/employees', label: 'Employees', Icon: Users },
                  { path: '/contacts', label: 'Messages', Icon: MessageSquare, badge: 3 },
                ].map(({ path, label, Icon, badge }) => (
                  <li key={path}>
                    <Link
                      to={path}
                      onClick={closeMenuOnClick}
                      className={`flex items-center py-2 px-3 rounded-lg transition-all duration-200 ${
                        isActive(path)
                          ? 'bg-gradient-to-r from-blue-50 to-violet-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                      aria-current={isActive(path) ? 'page' : undefined}
                    >
                      <Icon className={`w-5 h-5 mr-2 ${isActive(path) ? 'text-blue-600' : 'text-gray-500'}`} />
                      <span>{label}</span>
                      {badge && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-gradient-to-r from-blue-500 to-violet-500 text-white">
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-auto md:mt-0 md:ml-auto flex items-center space-x-4 px-4 md:px-0 py-4 md:py-0 border-t md:border-0 border-gray-100">
                <div className="relative" ref={notificationRef}>
                  <button
                    className="p-2 rounded-lg text-gray-600 hover:text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={toggleNotifications}
                    aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                    aria-expanded={isNotificationOpen}
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-rose-500 text-xs font-bold text-white flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {isNotificationOpen && (
                    <div
                      className="absolute mt-2 w-80 bg-white rounded-lg shadow-xl ring-1 ring-gray-200 z-50"
                      style={getDropdownPosition()}
                    >
                      <div className="p-4 border-b border-gray-100">
                        <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
                      </div>
                      <ul className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 && (
                          <li className="px-4 py-3 text-sm text-gray-500">No notifications</li>
                        )}
                        {notifications.map((n) => (
                          <li
                            key={n._id}
                            className={`px-4 py-3 hover:bg-gray-50 ${!n.read ? 'bg-blue-50/50' : ''}`}
                          >
                            <div className="flex items-center">
                              <div
                                className={`p-2 rounded-lg ${
                                  n.type === 'order' ? 'bg-blue-100 text-blue-600' :
                                  n.type === 'message' ? 'bg-violet-100 text-violet-600' :
                                  'bg-emerald-100 text-emerald-600'
                                }`}
                              >
                                {n.type === 'order' && <ShoppingBag className="w-4 h-4" />}
                                {n.type === 'message' && <MessageSquare className="w-4 h-4" />}
                                {n.type === 'user' && <Users className="w-4 h-4" />}
                              </div>
                              <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                                <p className="text-xs text-gray-500">{n.message}</p>
                                <p className="text-xs text-gray-400">
                                  {new Date(n.createdAt).toLocaleString()}
                                </p>
                              </div>
                              {!n.read && (
                                <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full" />
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="p-4 border-t border-gray-100">
                        <button 
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                          onClick={() => console.log("View all notifications")}
                        >
                          View all notifications
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative" ref={profileRef}>
                  <button
                    className="flex items-center p-2 rounded-lg text-gray-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={toggleProfile}
                    aria-label="Profile menu"
                    aria-expanded={isProfileOpen}
                  >
                    <img
                      src="https://i.pravatar.cc/150?img=12"
                      alt="Profile"
                      className="h-8 w-8 rounded-full border-2 border-white"
                    />
                    <span className="hidden md:block ml-2 text-sm font-medium">Admin</span>
                    <ChevronDown className="hidden md:block ml-1 w-4 h-4 text-gray-500" />
                  </button>

                  {isProfileOpen && (
                    <div
                      className="absolute mt-2 w-64 bg-white rounded-lg shadow-xl ring-1 ring-gray-200 z-50"
                      style={getDropdownPosition()}
                    >
                      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-violet-50">
                        <div className="flex items-center">
                          <img
                            src="https://i.pravatar.cc/150?img=12"
                            alt="Profile"
                            className="h-10 w-10 rounded-full border-2 border-white"
                          />
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">Admin User</p>
                            <p className="text-xs text-gray-500">admin@ksp.com</p>
                          </div>
                        </div>
                      </div>
                      <div className="py-1">
                        <button
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 w-full text-left"
                          onClick={() => console.log("Navigate to profile")}
                        >
                          <UserCircle className="mr-2 w-4 h-4 text-gray-500" />
                          My Profile
                        </button>
                        <button
                          className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 w-full text-left"
                          onClick={() => console.log("Navigate to settings")}
                        >
                          <Settings className="mr-2 w-4 h-4 text-gray-500" />
                          Settings
                        </button>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
                        >
                          <LogOut className="mr-2 w-4 h-4" />
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="h-16 md:h-20" />
    </>
  );
};

export default Navbar;
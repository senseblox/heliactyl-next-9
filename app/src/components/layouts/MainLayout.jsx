import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation, Outlet, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import axios from 'axios';
import {
  ServerStackIcon, BuildingLibraryIcon, ShoppingBagIcon,
  CurrencyDollarIcon, WindowIcon, FolderIcon, GlobeAltIcon, PuzzlePieceIcon,
  CloudArrowDownIcon, UsersIcon, Cog6ToothIcon, ServerIcon, ShoppingCartIcon, PlusIcon,
  ArrowRightOnRectangleIcon, UserIcon, Bars3Icon, XMarkIcon, WalletIcon, ChevronRightIcon,
  MagnifyingGlassIcon, BellIcon, ChevronDownIcon, CheckIcon, EllipsisHorizontalIcon, CircleStackIcon, 
  DocumentTextIcon, CubeIcon, LinkIcon, ScaleIcon, ListBulletIcon, EllipsisVerticalIcon, ArrowLeftIcon, ArrowTrendingUpIcon, GiftIcon, RocketLaunchIcon, FingerPrintIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline';
import LoadingScreen from '../LoadingScreen';
import PageTransition from '../PageTransition';

// Helper functions
function formatRelativeTime(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  
  return date.toLocaleDateString();
}

const MainLayout = () => {
  const [loadingState, setLoadingState] = useState('loading');
  const [isLoading, setIsLoading] = useState(true);
  const [balances, setBalances] = useState({
    coins: 0,
    credit: 0
  });
  const [userData, setUserData] = useState({
    username: 'Loading...',
    id: '...',
    email: '...',
    global_name: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [servers, setServers] = useState([]);
  const [subuserServers, setSubuserServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [menuDropdownOpen, setMenuDropdownOpen] = useState(false);
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showCommandK, setShowCommandK] = useState(false);
  const [serverName, setServerName] = useState("");
  const [showLatencyWarning, setShowLatencyWarning] = useState(false);
  const latencyTimerRef = useRef(null);
  const dismissTimerRef = useRef(null);

  const notificationRef = useRef(null);
  const userDropdownRef = useRef(null);
  const menuDropdownRef = useRef(null);
  const moreDropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const showServerSection = location.pathname.includes('/server/');

  useEffect(() => {
    if (showServerSection && id) {
      setSelectedServerId(id);
      // Find server name
      const currentServer = [...servers, ...subuserServers].find(
        server => server.id === id || (server.attributes && server.attributes.identifier === id)
      );
      
      if (currentServer) {
        setServerName(currentServer.name || (currentServer.attributes && currentServer.attributes.name));
      }
    }
  }, [id, showServerSection, servers, subuserServers]);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
      if (menuDropdownRef.current && !menuDropdownRef.current.contains(event.target)) {
        setMenuDropdownOpen(false);
      }
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target)) {
        setMoreDropdownOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // Command+K handler for search
  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    }
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Main navigation items
  const iconNavItems = [
    { 
      icon: <ServerStackIcon className="w-5 h-5" />,
      label: 'My servers',
      path: '/dashboard'
    },
    { 
      icon: <ShoppingBagIcon className="w-5 h-5" />,
      label: 'Store',
      path: '/coins/store'
    },
    {
      icon: <CircleStackIcon className="w-5 h-5" />,
      label: 'Earn coins',
      path: '/coins/afk'
    },
    {
      icon: <GiftIcon className="w-5 h-5" />,
      label: 'Daily rewards',
      path: '/coins/daily'
    }
  ];

  // More dropdown items
  const moreNavItems = [
    {
      icon: <RocketLaunchIcon className="w-5 h-5" />,
      label: 'Boosts',
      path: '/boosts'
    },
    {
      icon: <ArrowTrendingUpIcon className="w-5 h-5" />,
      label: 'Staking',
      path: '/coins/staking'
    }
  ];

  const serverNavItems = [
    { 
      icon: <WindowIcon className="w-5 h-5" />,
      label: 'Overview',
      path: `/server/${id}/overview`
    },
    { 
      icon: <FolderIcon className="w-5 h-5" />,
      label: 'Files',
      path: `/server/${id}/files`
    },
    { 
      icon: <GlobeAltIcon className="w-5 h-5" />,
      label: 'Network',
      path: `/server/${id}/network`
    },
    { 
      icon: <CloudArrowDownIcon className="w-5 h-5" />,
      label: 'Backups',
      path: `/server/${id}/backups`
    },
    {
      icon: <UsersIcon className="w-5 h-5" />,
      label: 'Users',
      path: `/server/${id}/users`
    },
    {
      icon: <Cog6ToothIcon className="w-5 h-5" />,
      label: 'Settings',
      path: `/server/${id}/settings`
    },
    {
      icon: <CubeIcon className="w-5 h-5" />,
      label: 'Package',
      path: `/server/${id}/package`
    },
    {
      icon: <PuzzlePieceIcon className="w-5 h-5" />,
      label: 'Plugins',
      path: `/server/${id}/plugins`
    },
    {
      icon: <ListBulletIcon className="w-5 h-5" />,
      label: 'Logs',
      path: `/server/${id}/logs`
    }
  ];
  
  const menuItems = [
    {
      icon: <LinkIcon className="w-4 h-4" />,
      label: 'Discord server',
      path: 'https://discord.gg/altare',
      external: true
    },
    {
      icon: <ArrowRightOnRectangleIcon className="w-4 h-4" />,
      label: 'Logout',
      action: handleLogout,
      className: 'text-red-400 hover:text-red-300 hover:bg-red-950/30'
    }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Start latency warning timer
        latencyTimerRef.current = setTimeout(() => {
          setShowLatencyWarning(true);
          
          // Auto-dismiss after 5 seconds
          dismissTimerRef.current = setTimeout(() => {
            setShowLatencyWarning(false);
          }, 7500);
        }, 500);
        
        // Your existing API calls
        const [creditResponse, coinsResponse, userResponse, serversResponse, subuserServersResponse, notificationsResponse] = await Promise.all([
          axios.get('/api/v5/billing/info'),
          axios.get('/api/coins'),
          axios.get('/api/user'),
          axios.get('/api/v5/servers'),
          axios.get('/api/subuser-servers'),
          axios.get('/notifications')
        ]);

        // Clear latency warning timer if data loaded fast enough
        if (latencyTimerRef.current) {
          clearTimeout(latencyTimerRef.current);
        }

        // Process all your data as before
        setBalances({
          credit: creditResponse.data.balances?.credit_usd || 0,
          coins: coinsResponse.data.coins || 0
        });
        
        setUserData({
          username: userResponse.data.username || 'User',
          id: userResponse.data.id || '00000',
          email: userResponse.data.email || '',
          global_name: userResponse.data.global_name || userResponse.data.username || 'User'
        });
        
        setServers(serversResponse.data || []);
        setSubuserServers(subuserServersResponse.data || []);
        
        // Process notifications
        const notificationData = notificationsResponse.data || [];
        const sortedNotifications = notificationData.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');
        
        const unreadCount = sortedNotifications.filter(
          notification => !readNotifications.includes(notification.timestamp)
        ).length;
        
        setNotifications(sortedNotifications);
        setUnreadNotifications(unreadCount);
        
        // Start transitioning away from loading screen
        setLoadingState('transitioning');

       // Signal loading complete
       setTimeout(() => {
        // Use an event to coordinate with the loading screen
        window.dispatchEvent(new Event('loadingComplete'));
        
        // Small delay before unmounting the loading screen completely
        setTimeout(() => {
          setIsLoading(false);
        }, 600);
      }, 300);
      } catch (error) {
        console.error('Error fetching data:', error);
        // Even on error, eventually transition away from loading screen
        setTimeout(() => {
          setLoadingState('transitioning');
          setTimeout(() => setLoadingState('complete'), 600);
        }, 1500);
      }
    };

    // Start data fetching
    fetchData();
    
    return () => {
      if (latencyTimerRef.current) {
        clearTimeout(latencyTimerRef.current);
      }
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  function handleLogout() {
    try {
      axios.post('/api/user/logout')
        .then(() => navigate('/auth'))
        .catch((error) => console.error('Logout error:', error));
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  function markAllAsRead() {
    const timestamps = notifications.map(notification => notification.timestamp);
    localStorage.setItem('readNotifications', JSON.stringify(timestamps));
    setUnreadNotifications(0);
  }
  
  function markAsRead(timestamp) {
    const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');
    if (!readNotifications.includes(timestamp)) {
      readNotifications.push(timestamp);
      localStorage.setItem('readNotifications', JSON.stringify(readNotifications));
      setUnreadNotifications(prev => Math.max(0, prev - 1));
    }
  }

  const isActivePath = (path) => location.pathname === path;

  const handleServerSelect = (serverId) => {
    if (serverId === 'new') {
      // Handle new server creation
      navigate('/dashboard');
      return;
    }
    
    setSelectedServerId(serverId);
    navigate(`/server/${serverId}/overview`);
  };

  const allServers = [
    ...servers.map(server => ({
      id: server.attributes.identifier,
      name: server.attributes.name,
      isOwned: true
    })),
    ...subuserServers.map(server => ({
      id: server.id,
      name: server.name,
      isOwned: false
    }))
  ];

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  const searchServers = (query) => {
    if (!query) return allServers;
    return allServers.filter(server => 
      server.name.toLowerCase().includes(query.toLowerCase()) ||
      server.id.toLowerCase().includes(query.toLowerCase())
    );
  };

  if (isLoading) return <LoadingScreen onComplete={true} />;

  return (
    <div className="min-h-screen bg-[#101114]">
      {/* Latency Warning */}
      <AnimatePresence>
        {showLatencyWarning && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: 0 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 10, x: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
            className="fixed bottom-4 right-4 z-50"
          >
            <div className="bg-[#222326] backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-lg flex items-start max-w-md">
              <div className="flex-shrink-0 mr-3 mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-300" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-white text-sm">Information: ALPHA State</h3>
                <p className="text-xs mt-1 text-white/60">TailHost's Dashboard is in a early ALPHA stage. It is not perfect and could occasionally have bugs, contact an admin if so.</p>
              </div>
              <button 
                onClick={() => setShowLatencyWarning(false)}
                className="ml-auto -mr-1 flex-shrink-0 text-white/50 hover:text-white transition-colors duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

        <header className="bg-[#101114] sticky top-0 z-30">
          <div className="flex items-center justify-between h-16 px-4">
            <div className="flex items-center">
          {/* Mobile Sidebar Toggle */}
          <button
            className="lg:hidden w-10 h-10 flex items-center justify-center text-[#95a1ad] rounded-lg transition-transform duration-200 active:scale-95 mr-2"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center space-x-2">
            <img src="https://i.postimg.cc/0ypkKwYD/Picsart-25-04-11-17-08-49-483.png" alt="Altare" className="h-8 w-auto" />
          </Link>
            </div>

            <div className="flex items-center space-x-4">
          {/* Search - Only on desktop */}
            <div className="relative hidden md:block">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search"
                  className="w-48 lg:w-64 bg-[#27292d] border border-transparent rounded-md py-1.5 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#4d5055]"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <div className="text-[#95a1ad] text-xs border border-[#4d5055] rounded px-1">⌘K</div>
                </div>
              </div>
            </div>
            
            {/* Notifications */}
            <div className="relative" ref={notificationRef}>
              <button
                className="relative p-2 text-[#95a1ad] hover:text-white rounded-lg hover:bg-[#27292d] transition-all duration-200 active:scale-95"
                onClick={() => setNotificationDropdownOpen(!notificationDropdownOpen)}
              >
                <BellIcon className="h-5 w-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500"></span>
                )}
              </button>
              
              {/* Notification dropdown */}
              <AnimatePresence>
                {notificationDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-80 bg-[#222427] border border-[#3f4147] rounded-md shadow-lg z-40"
                  >
                    <div className="flex items-center justify-between p-3 border-b border-[#3f4147]">
                      <h3 className="font-medium text-sm">Notifications</h3>
                      {notifications.length > 0 && (
                        <button 
                          className="text-xs text-[#95a1ad] hover:text-white transition-all duration-200 active:scale-95"
                          onClick={markAllAsRead}
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="py-6 px-3 text-center text-[#95a1ad] text-sm">
                          No notifications
                        </div>
                      ) : (
                        notifications.map((notification, index) => (
                          <div 
                            key={index}
                            className="p-3 border-b border-[#3f4147] hover:bg-[#2e3337] cursor-pointer transition-all duration-200 active:scale-95"
                            onClick={() => markAsRead(notification.timestamp)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="h-8 w-8 rounded-full bg-[#2e3337] flex items-center justify-center flex-shrink-0">
                                {notification.action.includes('logout') ? (
                                  <ArrowRightOnRectangleIcon className="w-4 h-4 text-white" />
                                ) : notification.action.includes('login') ? (
                                  <UserIcon className="w-4 h-4 text-white" />
                                ) : (
                                  <EllipsisHorizontalIcon className="w-4 h-4 text-white" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{notification.name}</p>
                                <p className="text-xs text-[#95a1ad] mt-0.5">
                                  {formatRelativeTime(notification.timestamp)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* User profile */}
            <div className="relative" ref={userDropdownRef}>
              <button 
                className="flex items-center space-x-2 text-[#95a1ad] hover:text-white transition-all duration-200 active:scale-95"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              >
                <div className="h-8 w-8 bg-[#27292d] border border-[#3f4147] rounded-md flex items-center justify-center">
                  <span className="text-xs font-medium">
                    {getInitials(userData.global_name)}
                  </span>
                </div>
                <span className="hidden md:block text-sm font-medium truncate max-w-[120px]">
                  {userData.global_name}
                </span>
                <ChevronDownIcon className={`hidden md:block w-4 h-4 transition-transform duration-300 ${userDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {userDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-64 bg-[#222427] border border-[#3f4147] rounded-md shadow-lg z-40"
                  >
                    <div className="p-3 border-b border-[#3f4147]">
                      <p className="text-sm font-medium">{userData.username}</p>
                      <p className="text-xs text-[#95a1ad] mt-1">{userData.email}</p>
                    </div>
                    <div className="py-1">
                      <button 
                        className="flex items-center w-full px-3 py-2.5 text-sm text-left hover:bg-[#2e3337] transition-all duration-200 active:scale-95"
                        onClick={() => {
                          navigate('/account');
                          setUserDropdownOpen(false);
                        }}
                      >
                        <UserIcon className="w-4 h-4 mr-2" />
                        <span className="font-medium">My account</span>
                      </button>
                    </div>
                    <div className="py-1">
                      <button 
                        className="flex items-center w-full px-3 py-2.5 text-sm text-left hover:bg-[#2e3337] transition-all duration-200 active:scale-95"
                        onClick={() => {
                          navigate('/passkeys');
                          setUserDropdownOpen(false);
                        }}
                      >
                        <FingerPrintIcon className="w-4 h-4 mr-2" />
                        <span className="font-medium">Passkeys</span>
                      </button>
                    </div>
                    <div className="py-1 border-t border-[#3f4147]">
                      <button 
                        className="flex items-center w-full px-3 py-2.5 text-sm text-left text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-all duration-200 active:scale-95"
                        onClick={() => {
                          handleLogout();
                          setUserDropdownOpen(false);
                        }}
                      >
                        <ArrowRightOnRectangleIcon className="w-4 h-4 mr-2" />
                        <span className="font-medium">Sign out</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Left Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 bg-[#101114] h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto">
          <div className="flex-grow px-4 space-y-6">
            {/* Main Navigation */}
            <div className="space-y-1">
              {!showServerSection ? (
                <>
                  {iconNavItems.map((item) => (
                    <Link
                      key={item.label}
                      to={item.path}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-md text-sm
                        transition-all duration-200 active:scale-95
                        ${isActivePath(item.path) 
                          ? 'bg-[#27292d] text-white' 
                          : 'text-[#95a1ad] hover:bg-[#1c1d21] hover:text-white'}
                      `}
                    >
                      {item.icon}
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  ))}
                  
                  {/* More dropdown */}
                  <div className="relative" ref={moreDropdownRef}>
                    <button
                      className={`
                        w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm
                        transition-all duration-200 active:scale-95
                        ${moreNavItems.some(item => isActivePath(item.path)) 
                          ? 'bg-[#27292d] text-white' 
                          : 'text-[#95a1ad] hover:bg-[#1c1d21] hover:text-white'}
                      `}
                      onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
                    >
                      <div className="flex items-center gap-3">
                        <EllipsisHorizontalIcon className="w-5 h-5" />
                        <span className="font-medium">More</span>
                      </div>
                      <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${moreDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    <AnimatePresence>
                      {moreDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="absolute top-full left-0 right-0 mt-1 bg-[#27292d] border border-[#3f4147] rounded-md shadow-lg z-20"
                        >
                          <div className="py-1">
                            {moreNavItems.map((item) => (
                              <Link
                                key={item.label}
                                to={item.path}
                                className={`
                                  flex items-center gap-3 px-3 py-2 text-sm
                                  transition-all duration-200 active:scale-95
                                  ${isActivePath(item.path)
                                    ? 'bg-[#1c1d21] text-white'
                                    : 'text-[#95a1ad] hover:bg-[#1c1d21] hover:text-white'}
                                `}
                                onClick={() => setMoreDropdownOpen(false)}
                              >
                                {item.icon}
                                <span>{item.label}</span>
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              ) : (
                // Server navigation when in server view
                <>
                  <div>
                    <button 
                      onClick={() => navigate('/dashboard')}
                      className="flex text-[#95a1ad] border border-white/5 rounded-md w-full p-3 mb-4 hover:text-white transition duration-200 text-xs active:scale-95 justify-center uppercase tracking-widest"
                    >
                      <ArrowLeftIcon className="w-4 h-4 mr-1.5" />
                      <span>Back to server list</span>
                    </button>
                  </div>
                  
                  {serverNavItems.map((item) => (
                    <Link
                      key={item.label}
                      to={item.path}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-md text-sm
                        transition-all duration-200 active:scale-95
                        ${isActivePath(item.path)
                          ? 'bg-[#27292d] text-white'
                          : 'text-[#95a1ad] hover:bg-[#1c1d21] hover:text-white'}
                      `}
                    >
                      {item.icon}
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  ))}
                </>
              )}
            </div>
          </div>
          
          {/* Bottom section with balances and copyright - Fixed at bottom */}
          <div className="mt-auto m-4 bg-transparent rounded-lg shadow-sm p-4 pb-2 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[#95a1ad]">Coins</span>
              <span className="text-sm font-medium text-white">{balances.coins.toFixed(2)}</span>
            </div>
            
            {/* Copyright/Menu */}
            <div ref={menuDropdownRef} className="relative">
              <button
                onClick={() => setMenuDropdownOpen(!menuDropdownOpen)}
                className="w-full flex items-center justify-between py-2 text-[#95a1ad] hover:text-white transition-all duration-200 active:scale-95"
              >
                <span className="text-xs">&copy; 2025 Altare Global IBC.</span>
                <EllipsisVerticalIcon className="w-5 h-5" />
              </button>
              
              <AnimatePresence>
                {menuDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-full mb-2 right-0 w-56 bg-[#27292d] border border-[#3f4147] rounded-md shadow-lg z-20"
                  >
                    <div className="py-1">
                      {menuItems.map((item, index) => (
                        <React.Fragment key={item.label}>
                          {item.action ? (
                            <button
                              className={`flex items-center w-full px-3 py-2 text-sm text-left transition-all duration-200 active:scale-95 ${item.className || 'hover:bg-[#1c1d21]'}`}
                              onClick={() => {
                                item.action();
                                setMenuDropdownOpen(false);
                              }}
                            >
                              {item.icon}
                              <span className="ml-2">{item.label}</span>
                            </button>
                          ) : item.external ? (
                            <a
                              href={item.path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-[#1c1d21] transition-all duration-200"
                            >
                              {item.icon}
                              <span className="ml-2">{item.label}</span>
                            </a>
                          ) : (
                            <Link
                              to={item.path}
                              className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-[#1c1d21] transition-all duration-200 active:scale-95"
                              onClick={() => setMenuDropdownOpen(false)}
                            >
                              {item.icon}
                              <span className="ml-2">{item.label}</span>
                            </Link>
                          )}
                          {index < menuItems.length - 1 && !item.className && <div className="my-1 border-t border-[#3f4147]" />}
                        </React.Fragment>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </aside>

        {/* Mobile Sidebar */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/60 z-40 lg:hidden"
                onClick={() => setMobileMenuOpen(false)}
              ></motion.div>
              
              {/* Sidebar */}
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed inset-y-0 left-0 w-72 bg-[#101114] border-r border-[#27292d] overflow-y-auto z-50 lg:hidden"
              >
                <div className="flex flex-col h-full">
                  {/* Header with logo or back button */}
                  <div className="flex items-center justify-between p-4 border-b border-[#27292d]">
                    {showServerSection ? (
                      <button
                        onClick={() => {
                          navigate('/dashboard');
                          setMobileMenuOpen(false);
                        }}
                        className="flex items-center gap-2 text-white border border-[#3f4147] rounded-lg px-3 py-2 hover:text-white/90 transition-all duration-200 active:scale-95"
                      >
                        <ArrowLeftIcon className="w-5 h-5" />
                        <span>Back to Dashboard</span>
                      </button>
                    ) : (
                      <Link to="/dashboard" className="flex items-center gap-3">
                        <img src="https://i.postimg.cc/0ypkKwYD/Picsart-25-04-11-17-08-49-483.png" alt="Logo" className="w-auto h-8" />
                      </Link>
                    )}
                    <button 
                      className="p-2 text-[#95a1ad] hover:text-white transition-all duration-200 active:scale-95"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>

                  {/* User profile section */}
                  <div className="px-4 py-3 border-b border-[#27292d]">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-[#27292d] border border-[#3f4147] rounded-md flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {getInitials(userData.global_name)} 
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-white">{userData.global_name}</span>
                        <span className="text-xs text-[#95a1ad]">{userData.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Search - Only when not in server view */}
                  {!showServerSection && (
                    <div className="px-4 py-3 border-b border-[#27292d]">
                      <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#95a1ad]" />
                        <input
                          type="text"
                          placeholder="Search servers..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 py-2.5 bg-[#27292d] border border-[#3f4147] rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#4d5055] transition-all duration-300" />
                      </div>
                    </div>
                  )}
    
                  {/* Server title when in server view for mobile */}
                  {showServerSection && (
                    <div className="px-4 py-3 border-b border-[#27292d]">
                      <div className="flex items-center gap-2">
                        <ServerStackIcon className="w-5 h-5 text-white/70" />
                        <h2 className="text-base font-medium text-white truncate">
                          {serverName || `Server ${id}`}
                        </h2>
                      </div>
                    </div>
                  )}
    
                  {/* Navigation */}
                  <div className="flex-grow py-4 px-4">
                    {/* Only show main nav when not in server view */}
                    {!showServerSection && (
                      <div className="space-y-1">
                        {iconNavItems.map((item) => (
                          <Link
                            key={item.label}
                            to={item.path}
                            className={`
                              flex items-center gap-3 px-3 py-2.5 rounded-md text-sm
                              transition-all duration-200 active:scale-95
                              ${isActivePath(item.path)
                                ? 'bg-[#27292d] text-white'
                                : 'text-[#95a1ad] hover:bg-[#1c1d21] hover:text-white'}
                            `}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {item.icon}
                            <span>{item.label}</span>
                          </Link>
                        ))}
                        
                        {/* More section in mobile */}
                        <div>
                          <button
                            className={`
                              w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm text-left
                              transition-all duration-200 active:scale-95
                              ${moreNavItems.some(item => isActivePath(item.path))
                                ? 'bg-[#27292d] text-white'
                                : 'text-[#95a1ad] hover:bg-[#1c1d21] hover:text-white'}
                            `}
                            onClick={() => setMoreDropdownOpen(!moreDropdownOpen)}
                          >
                            <div className="flex items-center gap-3">
                              <EllipsisHorizontalIcon className="w-5 h-5" />
                              <span>More</span>
                            </div>
                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${moreDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>
                          
                          <AnimatePresence>
                            {moreDropdownOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden ml-3"
                              >
                                {moreNavItems.map((item) => (
                                  <Link
                                    key={item.label}
                                    to={item.path}
                                    className={`
                                      flex items-center gap-3 px-3 py-2.5 mt-1 rounded-md text-sm
                                      transition-all duration-200 active:scale-95
                                      ${isActivePath(item.path)
                                        ? 'bg-[#27292d] text-white'
                                        : 'text-[#95a1ad] hover:bg-[#1c1d21] hover:text-white'}
                                    `}
                                    onClick={() => {
                                      setMobileMenuOpen(false);
                                      setMoreDropdownOpen(false);
                                    }}
                                  >
                                    {item.icon}
                                    <span>{item.label}</span>
                                  </Link>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}
    
                    {/* Server Navigation - Only shown in server view */}
                    {showServerSection && (
                      <div className="space-y-1">
                        {serverNavItems.map((item) => (
                          <Link
                            key={item.label}
                            to={item.path}
                            className={`
                              flex items-center gap-3 px-3 py-2.5 rounded-md text-sm
                              transition-all duration-200 active:scale-95
                              ${isActivePath(item.path)
                                ? 'bg-[#27292d] text-white'
                                : 'text-[#95a1ad] hover:bg-[#1c1d21] hover:text-white'}
                            `}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {item.icon}
                            <span>{item.label}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
    
                  {/* Bottom Section */}
                  <div className="mt-auto border-t border-[#27292d] p-4">
                    {/* Balance Section */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[#95a1ad]">Coins</span>
                      <span className="text-sm font-medium text-white">{balances.coins.toFixed(2)}</span>
                    </div>
                    
                    {/* Copyright */}
                    <div className="flex items-center justify-between text-[#95a1ad] text-xs">
                      <span>&copy; 2025 TailHost UK & Ireland</span>
                      
                      {/* Menu Items */}
                      <div className="relative" ref={menuDropdownRef}>
                        <button
                          onClick={() => setMenuDropdownOpen(!menuDropdownOpen)}
                          className="p-1 hover:text-white transition-all duration-200 active:scale-95"
                        >
                          <EllipsisVerticalIcon className="w-5 h-5" />
                        </button>
                        
                        <AnimatePresence>
                          {menuDropdownOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              transition={{ duration: 0.2 }}
                              className="absolute bottom-full right-0 mb-2 w-56 bg-[#27292d] border border-[#3f4147] rounded-md shadow-lg z-30"
                            >
                              <div className="py-1">
                                <Link
                                  to="/account"
                                  className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-[#1c1d21] transition-all duration-200 active:scale-95"
                                  onClick={() => {
                                    setMenuDropdownOpen(false);
                                    setMobileMenuOpen(false);
                                  }}
                                >
                                  <UserIcon className="w-4 h-4 mr-2" />
                                  <span>My account</span>
                                </Link>
                                
                                {menuItems.map((item, index) => (
                                  <React.Fragment key={item.label}>
                                    {item.action ? (
                                      <button
                                        className={`flex items-center w-full px-3 py-2 text-sm text-left transition-all duration-200 active:scale-95 ${item.className || 'hover:bg-[#1c1d21]'}`}
                                        onClick={() => {
                                          item.action();
                                          setMenuDropdownOpen(false);
                                          setMobileMenuOpen(false);
                                        }}
                                      >
                                        {item.icon}
                                        <span className="ml-2">{item.label}</span>
                                      </button>
                                    ) : item.external ? (
                                      <a
                                        href={item.path}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-[#1c1d21] transition-all duration-200"
                                      >
                                        {item.icon}
                                        <span className="ml-2">{item.label}</span>
                                      </a>
                                    ) : (
                                      <Link
                                        to={item.path}
                                        className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-[#1c1d21] transition-all duration-200 active:scale-95"
                                        onClick={() => {
                                          setMenuDropdownOpen(false);
                                          setMobileMenuOpen(false);
                                        }}
                                      >
                                        {item.icon}
                                        <span className="ml-2">{item.label}</span>
                                      </Link>
                                    )}
                                    {index < menuItems.length - 1 && !item.className && <div className="my-1 border-t border-[#3f4147]" />}
                                  </React.Fragment>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex-1 min-h-[calc(100vh-4rem)] bg-[#15171a] rounded-tl-2xl border border-white/5">
          <div className="max-w-screen-xl mx-auto">            
            {/* Main content area with padding */}
            <div className={`
              ${location.pathname === '/axis/chat' ? 'px-0' : 'px-6'} 
              ${showServerSection ? 'py-6' : 'py-4'} 
            `}>
              <AnimatePresence mode="wait">
                <PageTransition key={location.pathname}>
                  <Outlet />
                </PageTransition>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;

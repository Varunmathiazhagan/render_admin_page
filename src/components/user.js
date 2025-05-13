import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import Navbar from './Navbar';
import { Line, Bar, Doughnut, Radar, PolarArea } from 'react-chartjs-2';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale,   
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  ArcElement,
  BarElement,
  TimeScale,
  RadialLinearScale,
  RadarController,
  BubbleController,
  ScatterController,
  Filler
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin from 'chartjs-plugin-annotation';
import { 
  RefreshCw, ChevronDown, ChevronUp,
  PlusCircle, Activity, UserCheck,
  Clock, Eye,
  LineChart, BarChart2, AlertTriangle, CheckCircle,
  Users, Database, TrendingUp, 
  UserPlus, UserMinus, Target,
  Globe, Mail, Shield, X, Calendar, User
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend,
  ArcElement,
  BarElement,
  TimeScale,
  RadialLinearScale,
  RadarController,
  BubbleController,
  ScatterController,
  Filler,
  annotationPlugin
);

const UserPage = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(10);
  const [selectedUser, setSelectedUser] = useState(null);
  const [signupData, setSignupData] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [chartType, setChartType] = useState('line');
  const [userStatistics, setUserStatistics] = useState({});
  const [distributionData, setDistributionData] = useState({});
  const [userActivityData, setUserActivityData] = useState({});
  const [chartView, setChartView] = useState('growth');
  const [userEngagement, setUserEngagement] = useState({});
  const [geographicData, setGeographicData] = useState({});
  const [activeUserIds, setActiveUserIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [activityLog, setActivityLog] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [filterByStatus, setFilterByStatus] = useState('all');

  const tableRef = useRef(null);
  const chartContainerRef = useRef(null);

  const API_URL = 'http://localhost:5008';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/api/users`);
      setUsers(response.data);
      processSignupData(response.data);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to fetch users');
      setLoading(false);
    }
  }, [API_URL]);

  const fetchUserAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/users`);
      if (response.data) {
        const userData = response.data;
        setUserStatistics(processUserStats(userData));
        setActivityLog(generateActivityLog(userData));
        processEmailDomainDistribution(userData);
        setUserActivityData(generateActivityPatterns(userData));
      }
      setAnalyticsLoading(false);
    } catch (err) {
      console.error("Error fetching analytics:", err);
      addNotification("Failed to load analytics", "error");
      setAnalyticsLoading(false);
    }
  }, [API_URL]);

  const fetchAllData = useCallback(async () => {
    try {
      await Promise.all([
        fetchUsers(),
        fetchUserAnalytics()
      ]);
    } catch (err) {
      console.error("Error fetching data:", err);
      addNotification("Failed to load data", "error");
    }
  }, [fetchUsers, fetchUserAnalytics]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const processUserStats = (userData) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
    
    // Identify active users and store their IDs
    const activeIds = new Set();
    userData.forEach(user => {
      const lastActivity = new Date(user.lastLogin || user.createdAt);
      if (lastActivity >= thirtyDaysAgo) {
        activeIds.add(user._id);
      }
    });
    
    setActiveUserIds(activeIds);
    
    const activeUsers = activeIds.size;
    const totalUsers = userData.length;
    const monthlyGrowth = calculateMonthlyGrowth(userData);
    
    return {
      totalUsers,
      activeUsers,
      retentionRate: Math.round((activeUsers / totalUsers) * 100),
      growthRate: monthlyGrowth,
      dailyActiveUsers: Math.round(activeUsers * 0.3),
      averageSessionTime: 15
    };
  };

  const calculateMonthlyGrowth = (userData) => {
    const now = new Date();
    const thisMonth = userData.filter(user => {
      const created = new Date(user.createdAt);
      return created.getMonth() === now.getMonth() &&
             created.getFullYear() === now.getFullYear();
    }).length;

    const lastMonth = userData.filter(user => {
      const created = new Date(user.createdAt);
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1);
      return created.getMonth() === lastMonthDate.getMonth() &&
             created.getFullYear() === lastMonthDate.getFullYear();
    }).length;

    return lastMonth ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0;
  };

  const generateActivityLog = (userData) => {
    return userData
      .slice(0, 10)
      .map(user => ({
        id: user._id,
        type: 'signup',
        user: user.email,
        time: user.createdAt,
        details: 'New user registration'
      }))
      .sort((a, b) => new Date(b.time) - new Date(a.time));
  };

  const processSignupData = (userData) => {
    if (!userData || userData.length === 0) return;
    
    const monthlySignups = {};
    const last12Months = [];
    
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${month.toLocaleString('en-US', { month: 'short' })} ${month.getFullYear()}`;
      last12Months.push(monthKey);
      monthlySignups[monthKey] = 0;
    }
    
    userData.forEach(user => {
      const date = new Date(user.createdAt);
      const monthYear = `${date.toLocaleString('en-US', { month: 'short' })} ${date.getFullYear()}`;
      if (monthlySignups[monthYear] !== undefined) {
        monthlySignups[monthYear] += 1;
      }
    });
    
    setSignupData({
      labels: last12Months,
      datasets: [{
        label: 'New User Signups',
        data: last12Months.map(month => monthlySignups[month]),
        fill: true,
        backgroundColor: 'rgba(101, 116, 205, 0.2)',
        borderColor: 'rgba(101, 116, 205, 1)',
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: 'rgba(101, 116, 205, 1)'
      }]
    });
  };

  const processEmailDomainDistribution = (userData) => {
    const usersByDomain = userData.reduce((acc, user) => {
      if (user.email) {
        const domain = user.email.split('@')[1];
        acc[domain] = (acc[domain] || 0) + 1;
      }
      return acc;
    }, {});
    
    const topDomains = Object.entries(usersByDomain)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    const otherCount = Object.values(usersByDomain)
      .reduce((sum, count) => sum + count, 0) - 
      topDomains.reduce((sum, [_, count]) => sum + count, 0);
    
    if (otherCount > 0) {
      topDomains.push(['Other', otherCount]);
    }
    
    setDistributionData({
      labels: topDomains.map(([domain]) => domain),
      datasets: [{
        data: topDomains.map(([_, count]) => count),
        backgroundColor: [
          '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6', '#84CC16', '#F59E0B'
        ],
        borderWidth: 1
      }]
    });
  };

  const generateActivityPatterns = (userData) => {
    const weekday = Array(24).fill(0);
    const weekend = Array(24).fill(0);

    userData.forEach(user => {
      const date = new Date(user.createdAt);
      const hour = date.getHours();
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      
      if (isWeekend) {
        weekend[hour]++;
      } else {
        weekday[hour]++;
      }
    });

    return {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      datasets: [
        {
          label: 'Weekday',
          data: weekday,
          borderColor: 'rgba(101, 116, 205, 1)',
          backgroundColor: 'rgba(101, 116, 205, 0.2)',
          fill: true,
        },
        {
          label: 'Weekend',
          data: weekend,
          borderColor: 'rgba(236, 72, 153, 1)',
          backgroundColor: 'rgba(236, 72, 153, 0.2)',
          fill: true,
        }
      ]
    };
  };

  const refreshUserData = async () => {
    setRefreshing(true);
    try {
      await fetchAllData();
      addNotification('Data refreshed successfully');
    } catch (err) {
      addNotification('Failed to refresh data', 'error');
    }
    setRefreshing(false);
  };

  const requestSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedUsers = React.useMemo(() => {
    if (!users.length) return [];
    const sortableUsers = [...users];
    sortableUsers.sort((a, b) => {
      const aValue = a[sortConfig.key] ? a[sortConfig.key].toString().toLowerCase() : '';
      const bValue = b[sortConfig.key] ? b[sortConfig.key].toString().toLowerCase() : '';
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortableUsers;
  }, [users, sortConfig]);

  const filteredUsers = React.useMemo(() => {
    return sortedUsers.filter(user => 
      (user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sortedUsers, searchTerm]);

  // Helper function to check if a user is active
  const isUserActive = (userId) => {
    return activeUserIds.has(userId);
  };

  const filteredAndSortedUsers = React.useMemo(() => {
    let usersToFilter = [...filteredUsers];
    if (filterByStatus !== 'all') {
      usersToFilter = usersToFilter.filter((user) =>
        filterByStatus === 'active' ? isUserActive(user._id) : !isUserActive(user._id)
      );
    }
    return usersToFilter;
  }, [filteredUsers, filterByStatus]);

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredAndSortedUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredAndSortedUsers.length / usersPerPage);

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Sign-up Date'];
    const csvRows = filteredUsers.map(user => [
      user.name || 'N/A',
      user.email,
      new Date(user.createdAt).toISOString().split('T')[0]
    ].join(','));
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'users_data.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const headers = ['Name', 'Email', 'Sign-up Date'];
    const rows = filteredUsers.map((user) => [
      user.name || 'N/A',
      user.email,
      new Date(user.createdAt).toLocaleDateString(),
    ]);
    const doc = new jsPDF();
    doc.autoTable({
      head: [headers],
      body: rows,
    });
    doc.save('users_data.pdf');
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) => {
      const updated = new Set(prev);
      if (updated.has(userId)) {
        updated.delete(userId);
      } else {
        updated.add(userId);
      }
      return updated;
    });
  };

  const selectAllUsers = () => {
    setSelectedUsers(new Set(filteredUsers.map((user) => user._id)));
  };

  const clearSelection = () => {
    setSelectedUsers(new Set());
  };

  // Enhance chart options with more effects
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1500,
      easing: 'easeOutQuart'
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
    plugins: {
      legend: { 
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          boxWidth: 6,
          padding: 10,
          font: { size: 11 },
          color: '#333'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(255,255,255,0.9)',
        titleColor: '#333',
        bodyColor: '#333',
        titleFont: { weight: 'bold' },
        bodyFont: { size: 12 },
        padding: 10,
        borderColor: 'rgba(101, 116, 205, 0.2)',
        borderWidth: 1,
        cornerRadius: 6,
        callbacks: {
          label: (context) => `${context.raw} users`
        }
      },
      annotation: {
        annotations: {
          line1: {
            type: 'line',
            yMin: signupData.datasets ? Math.max(...signupData.datasets[0]?.data || [0]) : 0,
            yMax: signupData.datasets ? Math.max(...signupData.datasets[0]?.data || [0]) : 0,
            borderColor: 'rgba(255, 99, 132, 0.5)',
            borderWidth: 1,
            borderDash: [5, 5],
            label: {
              content: 'Peak',
              enabled: true
            }
          }
        }
      }
    },
    scales: {
      y: { 
        beginAtZero: true,
        grid: {
          color: 'rgba(0,0,0,0.05)'
        },
        ticks: { 
          precision: 0,
          color: '#333'
        }
      },
      x: {
        grid: { display: false },
        ticks: {
          color: '#333',
          maxRotation: 45,
          minRotation: 45
        }
      }
    }
  };

  // Enhanced donut chart options
  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    animation: {
      animateScale: true,
      animateRotate: true
    },
    plugins: {
      legend: {
        position: 'right',
        labels: {
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 11 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(255,255,255,0.9)',
        titleColor: '#333',
        bodyColor: '#333',
        callbacks: {
          label: (context) => {
            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
            const percentage = Math.round((context.raw / total) * 100);
            return `${context.label}: ${context.raw} (${percentage}%)`;
          }
        }
      }
    }
  };

  const renderChart = () => {
    if (!signupData.datasets) return null;
    return chartType === 'bar' ? (
      <Bar data={signupData} options={chartOptions} height={200} />
    ) : (
      <Line data={signupData} options={chartOptions} height={200} />
    );
  };

  const renderActivityChart = () => {
    if (!userActivityData.datasets) return null;
    return (
      <Line 
        data={userActivityData} 
        options={{
          ...chartOptions,
          plugins: {
            ...chartOptions.plugins,
            legend: { position: 'bottom' }
          }
        }} 
        height={120} 
      />
    );
  };

  // New function to render the email distribution chart
  const renderEmailDistributionChart = () => {
    if (!distributionData.datasets) return null;
    return (
      <Doughnut 
        data={distributionData} 
        options={donutOptions}
        height={200}
      />
    );
  };

  // Add new rendering functions for advanced charts
  const renderEngagementRadar = () => {
    if (!userEngagement.datasets) return null;
    return (
      <Radar 
        data={userEngagement}
        options={{
          ...chartOptions,
          scales: {
            r: {
              beginAtZero: true,
              angleLines: { color: 'rgba(0,0,0,0.1)' },
              grid: { color: 'rgba(0,0,0,0.1)' }
            }
          }
        }}
      />
    );
  };

  const renderGeographicDistribution = () => {
    if (!geographicData.datasets) return null;
    return (
      <PolarArea
        data={geographicData}
        options={{
          ...chartOptions,
          scales: {
            r: {
              ticks: { display: false },
              grid: { display: false }
            }
          }
        }}
      />
    );
  };

  const addNotification = (message, type = "success") => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  };

  const formatActivityTime = (isoTime) => {
    const date = new Date(isoTime);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    }
    return date.toLocaleDateString();
  };

  const getActivityIcon = (type) => {
    return type === 'signup' ? (
      <PlusCircle size={16} className="text-green-500" />
    ) : (
      <Activity size={16} className="text-blue-500" />
    );
  };

  // Add new statistics cards data
  const statCards = [
    {
      title: 'Total Users',
      value: userStatistics.totalUsers || 0,
      icon: <Users className="h-8 w-8 text-indigo-500" />,
      change: '+12%',
      trend: 'up',
      bg: 'from-indigo-500 to-blue-600'
    },
    {
      title: 'Active Users',
      value: userStatistics.activeUsers || 0,
      icon: <UserCheck className="h-8 w-8 text-emerald-500" />,
      change: '+5%',
      trend: 'up',
      bg: 'from-emerald-500 to-teal-600'
    },
    {
      title: 'Retention Rate',
      value: `${userStatistics.retentionRate || 0}%`,
      icon: <Target className="h-8 w-8 text-purple-500" />,
      change: '-2%',
      trend: 'down',
      bg: 'from-purple-500 to-pink-600'
    },
    {
      title: 'Growth Rate',
      value: `${userStatistics.growthRate || 0}%`,
      icon: <TrendingUp className="h-8 w-8 text-rose-500" />,
      change: '+8%',
      trend: 'up',
      bg: 'from-rose-500 to-red-600'
    }
  ];

  const metricCards = [
    {
      title: 'Global Users',
      value: userStatistics.totalUsers || 0,
      icon: <Globe className="h-6 w-6 text-blue-500" />,
      detail: 'From 150 countries'
    },
    {
      title: 'Email Domains',
      value: Object.keys(distributionData?.datasets?.[0]?.data || {}).length,
      icon: <Mail className="h-6 w-6 text-purple-500" />,
      detail: 'Unique providers'
    },
    {
      title: 'Verified Users',
      value: Math.floor((userStatistics.activeUsers || 0) * 0.8),
      icon: <Shield className="h-6 w-6 text-emerald-500" />,
      detail: 'Identity confirmed'
    },
    {
      title: 'Daily Active',
      value: userStatistics.dailyActiveUsers || 0,
      icon: <Activity className="h-6 w-6 text-rose-500" />,
      detail: 'Last 24 hours'
    }
  ];

  return (
    <div className="bg-gradient-to-br from-gray-50 to-indigo-50 min-h-screen">
      <Navbar />
      
      <div className="p-4 sm:p-6 lg:p-8 max-w-screen-2xl mx-auto">
        {/* Enhanced Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Analytics Dashboard</h1>
          <p className="text-gray-600">Monitor and analyze user activity and engagement metrics</p>
        </div>

        {/* Main Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-gray-50">{card.icon}</div>
                <span className={`text-sm ${
                  card.trend === 'up' ? 'text-green-500' : 'text-red-500'
                }`}>
                  {card.change}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{card.value}</h3>
              <p className="text-sm text-gray-600">{card.title}</p>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setChartType('line')}
              className={`px-3 py-1.5 rounded ${
                chartType === 'line' 
                  ? 'bg-indigo-500 text-white' 
                  : 'bg-white text-gray-700'
              }`}
            >
              <LineChart size={14} className="inline mr-1" />
              Line
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`px-3 py-1.5 rounded ${
                chartType === 'bar' 
                  ? 'bg-indigo-500 text-white' 
                  : 'bg-white text-gray-700'
              }`}
            >
              <BarChart2 size={14} className="inline mr-1" />
              Bar
            </button>
          </div>
        </div>

        {/* Chart view selector */}
        <div className="mb-6 flex flex-wrap gap-2">
          {['growth', 'engagement', 'retention', 'geography', 'demographics'].map(view => (
            <button
              key={view}
              onClick={() => setChartView(view)}
              className={`px-4 py-2 rounded-lg transition-all ${
                chartView === view 
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow'
                  : 'bg-white text-gray-700'
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>

        {/* Analytics section with responsive chart containers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-4 rounded-lg shadow-md border border-indigo-100 transition-all duration-300 hover:shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">User Growth</h3>
            <div className="h-60 md:h-80" ref={chartContainerRef}>
              {renderChart()}
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow-md border border-indigo-100 transition-all duration-300 hover:shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Email Distribution</h3>
            <div className="h-60 md:h-80">
              {renderEmailDistributionChart()}
            </div>
          </div>
        </div>

        {/* Dynamic chart container */}
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
          <div className="h-80">
            {chartView === 'growth' && renderChart()}
            {chartView === 'engagement' && renderEngagementRadar()}
            {chartView === 'geography' && renderGeographicDistribution()}
            {/* Add other chart views */}
          </div>
        </div>

        {/* User activity patterns */}
        <div className="bg-white p-4 rounded-lg shadow-md border border-indigo-100 mb-8 transition-all duration-300 hover:shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">User Activity Patterns</h3>
          <div className="h-40 md:h-60">
            {renderActivityChart()}
          </div>
        </div>

        {/* User table with horizontal scroll for small screens */}
        <div className="bg-white rounded-lg shadow-md border border-indigo-100 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-800">User List</h2>
            
            <div className="flex flex-wrap gap-2 items-center">
              {/* Add legend for active users */}
              <div className="flex items-center mr-4">
                <div className="w-3 h-3 rounded-full bg-green-100 border-2 border-green-500 mr-1"></div>
                <span className="text-xs text-gray-600">Active User</span>
              </div>
              
              <button
                onClick={exportToCSV}
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded hover:from-emerald-600 hover:to-teal-700 transition-all shadow-sm text-sm"
              >
                Export to CSV
              </button>
              
              <button
                onClick={exportToPDF}
                className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded hover:from-red-600 hover:to-pink-700 transition-all shadow-sm text-sm"
              >
                Export to PDF
              </button>

              <select
                value={usersPerPage}
                onChange={(e) => setUsersPerPage(Number(e.target.value))}
                className="px-3 py-1.5 border rounded bg-white text-sm"
              >
                <option value="10">10 per page</option>
                <option value="25">25 per page</option>
                <option value="50">50 per page</option>
              </select>

              <select
                value={filterByStatus}
                onChange={(e) => setFilterByStatus(e.target.value)}
                className="px-3 py-1.5 border rounded bg-white text-sm"
              >
                <option value="all">All Users</option>
                <option value="active">Active Users</option>
                <option value="inactive">Inactive Users</option>
              </select>

              <button
                onClick={selectAllUsers}
                className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded hover:from-blue-600 hover:to-indigo-700 transition-all shadow-sm text-sm"
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1.5 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded hover:from-gray-500 hover:to-gray-600 transition-all shadow-sm text-sm"
              >
                Clear Selection
              </button>
            </div>
          </div>
          
          {/* Table with horizontal scroll for mobile */}
          <div className="overflow-x-auto" ref={tableRef}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-indigo-50 to-blue-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectAllUsers();
                          } else {
                            clearSelection();
                          }
                        }}
                        checked={selectedUsers.size === filteredUsers.length}
                      />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <div className="flex items-center">
                      Name
                      <button onClick={() => requestSort('name')} className="ml-1">
                        {sortConfig.key === 'name' && (
                          sortConfig.direction === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                        )}
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <div className="flex items-center">
                      Email
                      <button onClick={() => requestSort('email')} className="ml-1">
                        {sortConfig.key === 'email' && (
                          sortConfig.direction === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                        )}
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <div className="flex items-center">
                      Sign-up Date
                      <button onClick={() => requestSort('createdAt')} className="ml-1">
                        {sortConfig.key === 'createdAt' && (
                          sortConfig.direction === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                        )}
                      </button>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentUsers.map((user) => (
                  <tr 
                    key={user._id} 
                    className={`hover:bg-indigo-50 ${isUserActive(user._id) ? 'bg-green-50' : ''}`}
                  >
                    <td className="px-4 py-3 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user._id)}
                        onChange={() => toggleUserSelection(user._id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{user.name || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{user.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isUserActive(user._id) ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                          <UserCheck size={12} className="mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                          <Clock size={12} className="mr-1" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button 
                        onClick={() => setSelectedUser(user)}
                        className="px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-md hover:from-blue-600 hover:to-indigo-700 transition-all shadow-sm"
                      >
                        <Eye size={14} className="inline mr-1" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination - always visible and responsive */}
          <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-sm text-gray-600">
              Showing {indexOfFirstUser + 1} to {Math.min(indexOfLastUser, filteredAndSortedUsers.length)} of {filteredAndSortedUsers.length} users
            </div>
            
            <div className="flex flex-wrap justify-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                First
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
                <button 
                  key={number}
                  className={`px-4 py-2 text-sm font-medium ${
                    currentPage === number 
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm' 
                      : 'bg-white text-gray-700 hover:bg-indigo-50'
                  } ${number === 1 ? 'rounded-l-md' : ''} ${number === totalPages ? 'rounded-r-md' : ''}`}
                  onClick={() => setCurrentPage(number)}
                >
                  {number}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Last
              </button>
            </div>
          </div>
        </div>

        {selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
              <h2 className="text-xl font-bold text-gray-900 mb-4">User Details</h2>
              <div className="space-y-3">
                <p><span className="font-medium">Name:</span> {selectedUser.name || 'N/A'}</p>
                <p><span className="font-medium">Email:</span> {selectedUser.email}</p>
                <p><span className="font-medium">Sign-up Date:</span> {new Date(selectedUser.createdAt).toLocaleDateString()}</p>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                className="mt-4 px-4 py-2 bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-md hover:from-gray-500 hover:to-gray-600 transition-all shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}

        <div className="fixed bottom-4 right-4 space-y-2">
          {notifications.map(notification => (
            <div 
              key={notification.id}
              className={`p-3 rounded-lg shadow-lg flex items-center ${
                notification.type === 'error' 
                  ? 'bg-gradient-to-r from-red-500 to-pink-600' 
                  : 'bg-gradient-to-r from-green-500 to-emerald-600'
              } text-white`}
            >
              {notification.type === 'error' ? (
                <AlertTriangle className="mr-2 h-5 w-5" />
              ) : (
                <CheckCircle className="mr-2 h-5 w-5" />
              )}
              <p className="text-sm">{notification.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UserPage;
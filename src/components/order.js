import React, { useState, useEffect } from "react";
import {
  FaSearch,
  FaSpinner,
  FaExclamationTriangle,
  FaEdit,
  FaTimes,
  FaEye,
  FaShoppingBag,
  FaBoxOpen,
  FaTruck,
  FaCheckCircle,
  FaBan,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaUser,
  FaCalendarAlt,
  FaPhoneAlt,
  FaEnvelope,
  FaDollarSign,
  FaHistory,
  FaMoneyBillWave,
  FaClock,
  FaCartPlus,
  FaShoppingBasket,
  FaPercent,
  FaRegClock,
  FaRegCalendarAlt,
  FaClipboardList,
} from "react-icons/fa";
import axios from "axios";
import Navbar from "./Navbar";
import { Bar, Line, Doughnut, Radar } from 'react-chartjs-2';
import API_BASE_URL, { getAuthHeaders } from '../config';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  LineElement,
  PointElement,
  ArcElement,
  Title, 
  Tooltip, 
  Legend,
  RadialLinearScale,
  RadarController,
  Filler
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  LineElement,
  PointElement,
  ArcElement,
  Title, 
  Tooltip, 
  Legend,
  RadialLinearScale,
  RadarController,
  Filler
);

// Customer Profile Component
const CustomerProfile = ({ customer }) => {
  if (!customer) return null;
  
  // Calculate days since last login
  const daysSinceLastLogin = customer.lastLogin ? 
    Math.floor((new Date() - new Date(customer.lastLogin)) / (1000 * 60 * 60 * 24)) : 'N/A';
  
  // Calculate account age in days
  const accountAge = customer.createdAt ? 
    Math.floor((new Date() - new Date(customer.createdAt)) / (1000 * 60 * 60 * 24)) : 'N/A';
  
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-100 p-5">
      <h3 className="text-lg font-semibold mb-3 flex items-center">
        <FaUser className="mr-2 text-indigo-500" /> Customer Profile
      </h3>
      
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="flex items-center text-sm">
            <span className="font-medium mr-2">Name:</span> {customer.name}
          </p>
          <p className="flex items-center text-sm">
            <FaEnvelope className="mr-2 text-indigo-500" /> {customer.email}
          </p>
          <p className="flex items-center text-sm">
            <FaPhoneAlt className="mr-2 text-indigo-500" /> {customer.phone || 'N/A'}
          </p>
          <p className="flex items-center text-sm">
            <FaCalendarAlt className="mr-2 text-indigo-500" /> Account age: {accountAge} days
          </p>
        </div>
        
        <div className="space-y-2">
          <p className="flex items-center text-sm">
            <FaHistory className="mr-2 text-indigo-500" /> Last login: {daysSinceLastLogin} days ago
          </p>
          <p className="flex items-center text-sm">
            <span className="font-medium mr-2">Orders:</span> {customer.orderHistory?.length || 0} total orders
          </p>
          <div className="flex items-center text-sm">
            <span className="font-medium mr-2">Preferences:</span>
            <div className="flex space-x-2">
              <span className={`px-2 py-1 rounded-full text-xs ${customer.preferences?.darkMode ? 'bg-gradient-to-r from-purple-200 to-purple-300 text-purple-800' : 'bg-gray-100 text-gray-600'}`}>
                {customer.preferences?.darkMode ? 'Dark mode' : 'Light mode'}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs ${customer.preferences?.notifications ? 'bg-gradient-to-r from-green-200 to-green-300 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                {customer.preferences?.notifications ? 'Notifications on' : 'Notifications off'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
        <p className="text-sm font-medium mb-1">Shipping Address:</p>
        <p className="text-sm text-gray-600 whitespace-pre-line">{customer.address || 'No address on file'}</p>
      </div>
    </div>
  );
};

// Enhanced Analytics Dashboard Component
const AnalyticsDashboard = ({ orders }) => {
  // Add a chart reference
  const radarChartRef = React.useRef(null);
  const hourlyChartRef = React.useRef(null);
  const statusChartRef = React.useRef(null);
  const revenueChartRef = React.useRef(null);

  // Add useEffect to destroy charts on unmount
  useEffect(() => {
    const radarChart = radarChartRef.current;
    const hourlyChart = hourlyChartRef.current;
    const statusChart = statusChartRef.current;
    const revenueChart = revenueChartRef.current;

    return () => {
      if (radarChart) {
        radarChart.destroy();
      }
      if (hourlyChart) {
        hourlyChart.destroy();
      }
      if (statusChart) {
        statusChart.destroy();
      }
      if (revenueChart) {
        revenueChart.destroy();
      }
    };
  }, []);

  // Process order data for charts
  const processChartData = () => {
    // Calculate total revenue and items first
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalPrice, 0);
    const totalItems = orders.reduce((sum, order) => 
      sum + (order.orderItems?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0)
    , 0);

    // Get last 7 days
    const last7Days = Array.from({length: 7}, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();
    
    // Count orders by day
    const ordersByDay = last7Days.map(day => {
      return orders.filter(order => 
        new Date(order.createdAt).toISOString().split('T')[0] === day
      ).length;
    });
    
    // Count orders by status
    const statusCounts = {};
    orders.forEach(order => {
      statusCounts[order.orderStatus] = (statusCounts[order.orderStatus] || 0) + 1;
    });
    
    // Calculate revenue by day
    const revenueByDay = last7Days.map(day => {
      return orders
        .filter(order => new Date(order.createdAt).toISOString().split('T')[0] === day)
        .reduce((total, order) => total + order.totalPrice, 0);
    });

    // Enhanced data processing for more metrics
    const hourlyDistribution = Array(24).fill(0);
    const dayOfWeekDistribution = Array(7).fill(0);
    const categoryDistribution = {};
    
    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      hourlyDistribution[orderDate.getHours()]++;
      dayOfWeekDistribution[orderDate.getDay()]++;
      
      order.orderItems?.forEach(item => {
        const category = item.category || 'Uncategorized';
        categoryDistribution[category] = (categoryDistribution[category] || 0) + item.quantity;
      });
    });

    return {
      ordersByDay: {
        labels: last7Days.map(day => day.slice(5)), // MM-DD format
        datasets: [{
          label: 'Orders',
          data: ordersByDay,
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1
        }]
      },
      ordersByStatus: {
        labels: Object.keys(statusCounts),
        datasets: [{
          data: Object.values(statusCounts),
          backgroundColor: [
            'rgba(245, 158, 11, 0.7)', // processing
            'rgba(59, 130, 246, 0.7)', // shipped
            'rgba(16, 185, 129, 0.7)', // delivered
            'rgba(239, 68, 68, 0.7)'   // cancelled
          ],
          borderWidth: 1
        }]
      },
      revenueByDay: {
        labels: last7Days.map(day => day.slice(5)), // MM-DD format
        datasets: [{
          label: 'Revenue (₹)',
          data: revenueByDay,
          backgroundColor: 'rgba(16, 185, 129, 0.5)',
          borderColor: 'rgb(16, 185, 129)',
          borderWidth: 1,
          fill: false,
          tension: 0.1
        }]
      },
      hourlyOrders: {
        labels: Array.from({length: 24}, (_, i) => `${i}:00`),
        datasets: [{
          label: 'Orders by Hour',
          data: hourlyDistribution,
          backgroundColor: 'rgba(147, 51, 234, 0.5)',
          borderColor: 'rgb(147, 51, 234)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      
      orderRadar: {
        labels: ['Processing', 'Shipped', 'Delivered', 'Cancelled', 'Revenue', 'Items'],
        datasets: [{
          label: 'Order Metrics',
          data: [
            orders.filter(o => o.orderStatus === 'processing').length,
            orders.filter(o => o.orderStatus === 'shipped').length,
            orders.filter(o => o.orderStatus === 'delivered').length,
            orders.filter(o => o.orderStatus === 'cancelled').length,
            Math.min(100, (totalRevenue / 10000) * 100), // Now totalRevenue is defined
            Math.min(100, (totalItems / 100) * 100),
          ],
          backgroundColor: 'rgba(99, 102, 241, 0.4)',
          borderColor: 'rgb(99, 102, 241)',
          borderWidth: 2,
          pointBackgroundColor: 'rgb(99, 102, 241)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgb(99, 102, 241)'
        }]
      }
    };
  };
  
  const chartData = processChartData();
  
  // Calculate key metrics
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + order.totalPrice, 0);

  // Enhanced chart options with 3D effects and animations
  const enhancedChartOptions = {
    plugins: {
      legend: {
        labels: {
          font: {
            family: 'Inter, system-ui, sans-serif',
            weight: '500'
          }
        }
      }
    },
    scales: {
      r: {
        beginAtZero: true,
        grid: {
          color: 'rgba(99, 102, 241, 0.1)'
        },
        angleLines: {
          color: 'rgba(99, 102, 241, 0.1)'
        },
        ticks: {
          backdropColor: 'transparent',
          callback: (value) => value // Add this callback
        },
        pointLabels: {
          font: {
            size: 12
          }
        }
      }
    },
    animation: {
      duration: 2000,
      easing: 'easeInOutQuart'
    },
    responsive: true,
    maintainAspectRatio: false
  };

  // Add new metrics calculation
  const calculateMetrics = () => {
    const total = orders.length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = orders.filter(order => 
      new Date(order.createdAt) >= today
    ).length;

    const totalRevenue = orders.reduce((sum, order) => sum + order.totalPrice, 0);
    const avgOrderValue = total ? totalRevenue / total : 0;
    
    const last24Hours = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const last24HoursOrders = orders.filter(order => 
      new Date(order.createdAt) >= last24Hours
    ).length;

    return {
      todayOrders,
      last24HoursOrders,
      totalRevenue,
      avgOrderValue,
      orderFrequency: (total / 30).toFixed(1), // Orders per day
      paymentSuccessRate: total > 0
        ? ((orders.filter((order) => order.paymentStatus === 'completed').length / total) * 100).toFixed(1)
        : '0.0',
    };
  };

  const metrics = calculateMetrics();

  return (
    <div className="space-y-6">
      {/* New Overview Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-xl p-6 shadow-lg border border-indigo-100">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-indigo-100 rounded-lg p-3">
              <FaCartPlus className="text-indigo-600 text-xl" />
            </div>
            <span className="text-sm font-medium text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full">
              Today
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-1">
            {metrics.todayOrders}
          </h3>
          <p className="text-sm text-gray-600">New Orders Today</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 rounded-xl p-6 shadow-lg border border-emerald-100">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-emerald-100 rounded-lg p-3">
              <FaMoneyBillWave className="text-emerald-600 text-xl" />
            </div>
            <span className="text-sm font-medium text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
              Revenue
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-1">
            ₹{metrics.totalRevenue.toFixed(2)}
          </h3>
          <p className="text-sm text-gray-600">Total Revenue</p>
        </div>

        <div className="bg-gradient-to-br from-violet-50 via-white to-purple-50 rounded-xl p-6 shadow-lg border border-violet-100">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-violet-100 rounded-lg p-3">
              <FaShoppingBasket className="text-violet-600 text-xl" />
            </div>
            <span className="text-sm font-medium text-violet-600 bg-violet-100 px-2 py-1 rounded-full">
              Average
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-1">
            ₹{metrics.avgOrderValue.toFixed(2)}
          </h3>
          <p className="text-sm text-gray-600">Average Order Value</p>
        </div>

        <div className="bg-gradient-to-br from-rose-50 via-white to-pink-50 rounded-xl p-6 shadow-lg border border-rose-100">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-rose-100 rounded-lg p-3">
              <FaClock className="text-rose-600 text-xl" />
            </div>
            <span className="text-sm font-medium text-rose-600 bg-rose-100 px-2 py-1 rounded-full">
              24h
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-1">
            {metrics.last24HoursOrders}
          </h3>
          <p className="text-sm text-gray-600">Orders in 24h</p>
        </div>
      </div>

      {/* Additional Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 rounded-lg p-2">
              <FaRegClock className="text-blue-600 text-lg" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Order Frequency</p>
              <p className="text-lg font-semibold text-gray-800">
                {metrics.orderFrequency} per day
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 rounded-lg p-2">
              <FaPercent className="text-green-600 text-lg" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Payment Success Rate</p>
              <p className="text-lg font-semibold text-gray-800">
                {metrics.paymentSuccessRate}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 rounded-lg p-2">
              <FaRegCalendarAlt className="text-purple-600 text-lg" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Processing Time</p>
              <p className="text-lg font-semibold text-gray-800">
                ~2.5 days
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="bg-pink-100 rounded-lg p-2">
              <FaClipboardList className="text-pink-600 text-lg" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Fulfillment Rate</p>
              <p className="text-lg font-semibold text-gray-800">
                {orders.length > 0 ? ((orders.filter(o => o.orderStatus === 'delivered').length / orders.length) * 100).toFixed(1) : '0.0'}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced chart layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h4 className="text-lg font-semibold mb-4 text-gray-800">Order Distribution</h4>
          <div className="h-80">
            <Line 
              ref={hourlyChartRef}
              data={chartData.hourlyOrders}
              options={{
                ...enhancedChartOptions,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#1f2937',
                    bodyColor: '#4b5563',
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h4 className="text-lg font-semibold mb-4 text-gray-800">Performance Metrics</h4>
          <div className="h-80">
            <Radar 
              ref={radarChartRef}
              data={chartData.orderRadar}
              options={enhancedChartOptions}
            />
          </div>
        </div>
      </div>

      {/* Enhanced status breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h4 className="text-lg font-semibold mb-4 text-gray-800">Order Status</h4>
          <div className="h-64">
            <Doughnut 
              ref={statusChartRef}
              data={chartData.ordersByStatus}
              options={{
                ...enhancedChartOptions,
                cutout: '60%',
                plugins: {
                  legend: {
                    position: 'right',
                    labels: {
                      usePointStyle: true,
                      padding: 20,
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <h4 className="text-lg font-semibold mb-4 text-gray-800">Revenue Trend</h4>
          <div className="h-64">
            <Bar 
              ref={revenueChartRef}
              data={chartData.revenueByDay}
              options={{
                ...enhancedChartOptions,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  y: {
                    grid: {
                      display: true,
                      drawBorder: false,
                      color: 'rgba(107, 114, 128, 0.1)'
                    }
                  },
                  x: {
                    grid: {
                      display: false
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced OrderDetailsModal component
const OrderDetailsModal = ({ order, onClose, onStatusChange, statusOptions, getStatusBadgeStyle, formatDate, customers }) => {
  const [localStatus, setLocalStatus] = useState(order?.orderStatus || "processing");
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  
  // Find customer data if available
  const customer = customers?.find(c => c.email === order?.userEmail) || null;
  
  // When order changes (especially when modal opens), update localStatus
  useEffect(() => {
    if (order) {
      setLocalStatus(order.orderStatus);
    }
  }, [order]);
  
  if (!order) return null;
  
  const handleStatusUpdate = async () => {
    if (localStatus === order.orderStatus) return;
    
    setUpdating(true);
    try {
      await onStatusChange(order._id, localStatus);
      // Status will be updated in parent component's state
    } catch (error) {
      console.error("Failed to update from modal:", error);
      setLocalStatus(order.orderStatus); // Reset on error
    } finally {
      setUpdating(false);
    }
  };

  // Calculate order metrics
  const itemCount = order.orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const daysElapsed = Math.floor((new Date() - new Date(order.createdAt)) / (1000 * 60 * 60 * 24));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-200 p-3 sm:p-4">
          <h3 className="text-base sm:text-lg font-semibold flex items-center text-gray-800">
            <FaShoppingBag className="mr-2 text-indigo-500" /> Order #{order.orderReference}
          </h3>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 transition-colors p-1"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>
        
        <div className="border-b border-gray-200">
          <div className="flex">
            <button 
              onClick={() => setActiveTab('details')}
              className={`py-2 sm:py-3 px-3 sm:px-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'details' 
                  ? 'border-indigo-500 text-indigo-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Order Details
            </button>
            {customer && (
              <button 
                onClick={() => setActiveTab('customer')}
                className={`py-2 sm:py-3 px-3 sm:px-4 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'customer' 
                    ? 'border-indigo-500 text-indigo-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Customer Profile
              </button>
            )}
          </div>
        </div>
        
        <div className="p-3 sm:p-5">
          {activeTab === 'details' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 shadow-sm transition-transform hover:scale-105 duration-300">
                  <p className="text-xs text-blue-600 font-medium">ORDER ITEMS</p>
                  <p className="text-2xl font-bold text-blue-700">{itemCount}</p>
                  <p className="text-xs text-blue-600 mt-1">Total items</p>
                </div>
                
                <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg p-4 shadow-sm transition-transform hover:scale-105 duration-300">
                  <p className="text-xs text-violet-600 font-medium">ORDER TOTAL</p>
                  <p className="text-2xl font-bold text-violet-700">₹{order.totalPrice.toFixed(2)}</p>
                  <p className="text-xs text-violet-600 mt-1">Inc. ₹{order.deliveryPrice?.toFixed(2) || '0.00'} delivery</p>
                </div>
                
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 shadow-sm transition-transform hover:scale-105 duration-300">
                  <p className="text-xs text-amber-600 font-medium">ORDER AGE</p>
                  <p className="text-2xl font-bold text-amber-700">{daysElapsed} days</p>
                  <p className="text-xs text-amber-600 mt-1">Since placement</p>
                </div>
              </div>
            
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-5 rounded-lg shadow-sm border border-gray-100">
                  <h4 className="font-medium text-gray-700 mb-3">Order Information</h4>
                  <p className="text-sm mb-2"><span className="font-semibold">Order ID:</span> {order._id}</p>
                  <p className="text-sm mb-2"><span className="font-semibold">Reference:</span> {order.orderReference}</p>
                  <p className="text-sm mb-2"><span className="font-semibold">Date:</span> {formatDate(order.createdAt)}</p>
                  <p className="text-sm mb-4"><span className="font-semibold">Last Updated:</span> {formatDate(order.updatedAt)}</p>
                  
                  <div className="mt-4">
                    <p className="text-sm mb-2"><span className="font-semibold">Current Status:</span> 
                      <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium" style={getStatusBadgeStyle(order.orderStatus)}>
                        {order.orderStatus}
                      </span>
                    </p>
                    
                    <div className="mt-3">
                      <label htmlFor="status-update" className="block text-sm font-medium text-gray-700 mb-1">
                        Update Status:
                      </label>
                      <div className="flex items-center">
                        <select 
                          id="status-update"
                          value={localStatus} 
                          onChange={(e) => setLocalStatus(e.target.value)}
                          disabled={updating}
                          className="flex-1 rounded-md border-gray-300 shadow-sm text-sm bg-white text-gray-900"
                        >
                          {statusOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        
                        <button 
                          onClick={handleStatusUpdate} 
                          disabled={updating || localStatus === order.orderStatus}
                          className={`ml-2 px-3 py-1.5 rounded text-sm font-medium ${
                            updating || localStatus === order.orderStatus 
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                              : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg'
                          } transition-all duration-200`}
                        >
                          {updating ? <FaSpinner className="inline animate-spin mr-1" /> : "Update"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-gray-50 to-indigo-50 p-5 rounded-lg shadow-sm border border-gray-100">
                  <h4 className="font-medium text-gray-700 mb-3">Customer Information</h4>
                  <p className="text-sm mb-2"><span className="font-semibold">Name:</span> {order.userName || "N/A"}</p>
                  <p className="text-sm mb-2"><span className="font-semibold">Email:</span> {order.userEmail || "N/A"}</p>
                  <p className="text-sm mb-1"><span className="font-semibold">Shipping Address:</span></p>
                  <div className="mt-1 p-3 bg-white rounded-md border border-gray-100 text-sm text-gray-600">
                    {order.shippingInfo && (
                      <>
                        <p>{order.shippingInfo.fullName}</p>
                        <p>{order.shippingInfo.addressLine1}</p>
                        <p>{order.shippingInfo.city}, {order.shippingInfo.postalCode}</p>
                      </>
                    )}
                  </div>
                  
                  {customer && (
                    <button
                      onClick={() => setActiveTab('customer')}
                      className="mt-4 text-sm bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-700 px-3 py-1.5 rounded-md flex items-center justify-center transition-colors duration-200 shadow-sm"
                    >
                      <FaUser className="mr-1" /> View full customer profile
                    </button>
                  )}
                </div>
              </div>
              
              <div className="mt-6 bg-gradient-to-br from-gray-50 to-gray-100 p-3 sm:p-5 rounded-lg shadow-sm border border-gray-100">
                <h4 className="font-medium text-gray-700 mb-3">Order Items</h4>
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {order.orderItems && order.orderItems.map((item, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gradient-to-r from-gray-50 to-indigo-50/20'}>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">₹{item.price.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gradient-to-r from-gray-50 to-indigo-50/30">
                        <td colSpan="3" className="px-4 py-2 text-sm font-medium text-right text-gray-700">Subtotal</td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">₹{order.subtotal ? order.subtotal.toFixed(2) : "N/A"}</td>
                      </tr>
                      <tr className="bg-gradient-to-r from-gray-50 to-indigo-50/30">
                        <td colSpan="3" className="px-4 py-2 text-sm font-medium text-right text-gray-700">Delivery Fee</td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">₹{order.deliveryPrice ? order.deliveryPrice.toFixed(2) : "0.00"}</td>
                      </tr>
                      <tr className="bg-gradient-to-r from-indigo-50 to-purple-50">
                        <td colSpan="3" className="px-4 py-2 text-base font-bold text-right text-gray-800">Total</td>
                        <td className="px-4 py-2 text-base font-bold text-gray-900">₹{order.totalPrice.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              
              <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm">
                  <span className="font-semibold">Payment Method:</span> {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Razorpay'}
                  <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium" style={getStatusBadgeStyle(order.paymentStatus || 'pending')}>
                    {order.paymentStatus || 'pending'}
                  </span>
                </p>
                <button 
                  onClick={onClose} 
                  className="px-4 py-2 bg-gradient-to-r from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 rounded-md text-gray-800 text-sm font-medium transition-colors shadow-sm w-full sm:w-auto"
                >
                  Close
                </button>
              </div>
            </>
          ) : (
            // Customer Profile Tab
            <CustomerProfile customer={customer} />
          )}
        </div>
      </div>
    </div>
  );
};

const AdminOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("createdAt");
  const [sortDirection, setSortDirection] = useState("desc");
  const [editingOrder, setEditingOrder] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);

  const API_URL = API_BASE_URL;

  // Fetch orders from the server
  const fetchOrders = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_URL}/api/orders/admin/all`, {
        timeout: 15008,
        headers: getAuthHeaders(),
      });

      if (!response.data || !response.data.success) {
        throw new Error("Invalid response format from server");
      }

      const formattedOrders = response.data.orders.map((order) => ({
        ...order,
        createdAt: new Date(order.createdAt),
        updatedAt: order.updatedAt ? new Date(order.updatedAt) : null,
      }));

      setOrders(formattedOrders);
      
      // Also fetch customers for enhanced order details
      fetchCustomers();
    } catch (error) {
      console.error("Error fetching orders:", error);
      setError(
        error.response?.data?.message ||
          (error.code === "ECONNABORTED"
            ? "Request timed out. The server may be down."
            : error.message) ||
          "Failed to load orders. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch customers data
  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`, {
        timeout: 10000,
        headers: getAuthHeaders(),
      });
      
      if (response.data && Array.isArray(response.data)) {
        setCustomers(response.data);
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
      // Don't set error state here as it would override orders error
    }
  };

  // Fetch orders on component mount
  useEffect(() => {
    fetchOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Handle status update
  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingStatus(true);
    try {
      const response = await axios.put(
        `${API_URL}/api/orders/admin/${orderId}/status`,
        { status: newStatus },
        { headers: { 'Content-Type': 'application/json', ...getAuthHeaders() } }
      );
  
      if (response.data.success) {
        const updatedOrder = response.data.order;
  
        // Update the orders state
        setOrders((prevOrders) =>
          prevOrders.map((order) =>
            order._id === orderId
              ? {
                  ...order,
                  orderStatus: updatedOrder.orderStatus,
                  updatedAt: new Date(updatedOrder.updatedAt || Date.now()),
                }
              : order
          )
        );
  
        // Update the selected order details if it's open
        if (selectedOrderDetails && selectedOrderDetails._id === orderId) {
          setSelectedOrderDetails((prev) => ({
            ...prev,
            orderStatus: updatedOrder.orderStatus,
            updatedAt: new Date(updatedOrder.updatedAt || Date.now()),
          }));
        }
      } else {
        throw new Error(response.data.message || "Failed to update order status");
      }
    } catch (error) {
      console.error("Error updating order status:", error);
      alert(
        error.response?.data?.message ||
          "Failed to update order status. Please try again."
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handle viewing order details
  const handleViewOrderDetails = (order) => {
    setSelectedOrderDetails(order);
    setShowOrderDetails(true);
  };

  // Filter and sort orders
  const filteredOrders = orders
    .filter((order) => {
      if (statusFilter !== "all" && order.orderStatus !== statusFilter) {
        return false;
      }
      if (searchTerm.trim() !== "") {
        const searchLower = searchTerm.toLowerCase();
        return (
          order._id.toLowerCase().includes(searchLower) ||
          order.orderReference.toLowerCase().includes(searchLower) ||
          order.userName.toLowerCase().includes(searchLower) ||
          order.userEmail.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortField === "createdAt") {
        return sortDirection === "asc"
          ? a.createdAt - b.createdAt
          : b.createdAt - a.createdAt;
      }
      if (sortField === "totalPrice") {
        return sortDirection === "asc"
          ? a.totalPrice - b.totalPrice
          : b.totalPrice - a.totalPrice;
      }
      if (typeof a[sortField] === "string") {
        return sortDirection === "asc"
          ? a[sortField].localeCompare(b[sortField])
          : b[sortField].localeCompare(a[sortField]);
      }
      return 0;
    });

  // Status options for dropdown
  const statusOptions = [
    { value: "processing", label: "Processing", icon: <FaBoxOpen /> },
    { value: "shipped", label: "Shipped", icon: <FaTruck /> },
    { value: "delivered", label: "Delivered", icon: <FaCheckCircle /> },
    { value: "cancelled", label: "Cancelled", icon: <FaBan /> },
  ];

  // Get status badge style
  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case "processing":
        return { backgroundColor: "#fef3c7", color: "#d97706" };
      case "shipped":
        return { backgroundColor: "#dbeafe", color: "#1e40af" };
      case "delivered":
        return { backgroundColor: "#d1fae5", color: "#047857" };
      case "cancelled":
        return { backgroundColor: "#fee2e2", color: "#b91c1c" };
      default:
        return { backgroundColor: "#f3f4f6", color: "#374151" };
    }
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  // Add this helper function to calculate status metrics
  const calculateStatusMetrics = () => {
    const total = orders.length;
    const processing = orders.filter(o => o.orderStatus === 'processing');
    const shipped = orders.filter(o => o.orderStatus === 'shipped');
    const delivered = orders.filter(o => o.orderStatus === 'delivered');
    const cancelled = orders.filter(o => o.orderStatus === 'cancelled');

    return {
      processing: {
        count: processing.length,
        percentage: total ? ((processing.length / total) * 100).toFixed(1) : 0,
        value: processing.reduce((sum, order) => sum + order.totalPrice, 0).toFixed(2)
      },
      shipped: {
        count: shipped.length,
        percentage: total ? ((shipped.length / total) * 100).toFixed(1) : 0,
        value: shipped.reduce((sum, order) => sum + order.totalPrice, 0).toFixed(2)
      },
      delivered: {
        count: delivered.length,
        percentage: total ? ((delivered.length / total) * 100).toFixed(1) : 0,
        value: delivered.reduce((sum, order) => sum + order.totalPrice, 0).toFixed(2)
      },
      cancelled: {
        count: cancelled.length,
        percentage: total ? ((cancelled.length / total) * 100).toFixed(1) : 0,
        value: cancelled.reduce((sum, order) => sum + order.totalPrice, 0).toFixed(2)
      }
    };
  };

  // Render loading state
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-screen bg-white">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border-t-4 border-b-4 border-indigo-500 animate-spin"></div>
              <div className="absolute inset-2 rounded-full border-t-4 border-b-4 border-purple-500 animate-spin animation-delay-150"></div>
              <div className="absolute inset-4 rounded-full border-t-4 border-b-4 border-blue-500 animate-spin animation-delay-300"></div>
            </div>
            <p className="text-gray-600">Loading order data...</p>
          </div>
        </div>
      </>
    );
  }

  // Render error state
  if (error) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center h-screen bg-white">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center border border-gray-200">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-red-500 to-pink-500 flex items-center justify-center mx-auto mb-4">
              <FaExclamationTriangle className="text-white text-2xl" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button 
              onClick={fetchOrders} 
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-md transition-all duration-200 font-medium shadow-md hover:shadow-lg"
            >
              Try Again
            </button>
          </div>
        </div>
      </>
    );
  }

  // Render main content
  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Orders Management</h1>
          
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <div className="relative flex-grow sm:flex-grow-0">
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded px-3 py-2 bg-white"
            >
              <option value="all">All Statuses</option>
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* New Status Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Processing Card */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl shadow-lg border border-amber-100 p-4 transition-all duration-300 hover:shadow-xl hover:scale-105">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-amber-100 rounded-lg p-2">
                <FaBoxOpen className="text-amber-600 text-xl" />
              </div>
              <span className="text-amber-600 text-sm font-medium px-2 py-1 bg-amber-100 rounded-full">
                {calculateStatusMetrics().processing.percentage}%
              </span>
            </div>
            <h3 className="text-2xl font-bold text-amber-700 mb-1">
              {calculateStatusMetrics().processing.count}
            </h3>
            <p className="text-amber-600 font-medium mb-2">Processing Orders</p>
            <div className="flex items-center text-amber-800">
              <FaDollarSign className="mr-1" />
              <span className="text-sm">₹{calculateStatusMetrics().processing.value}</span>
            </div>
          </div>

          {/* Shipped Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg border border-blue-100 p-4 transition-all duration-300 hover:shadow-xl hover:scale-105">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-blue-100 rounded-lg p-2">
                <FaTruck className="text-blue-600 text-xl" />
              </div>
              <span className="text-blue-600 text-sm font-medium px-2 py-1 bg-blue-100 rounded-full">
                {calculateStatusMetrics().shipped.percentage}%
              </span>
            </div>
            <h3 className="text-2xl font-bold text-blue-700 mb-1">
              {calculateStatusMetrics().shipped.count}
            </h3>
            <p className="text-blue-600 font-medium mb-2">Shipped Orders</p>
            <div className="flex items-center text-blue-800">
              <FaDollarSign className="mr-1" />
              <span className="text-sm">₹{calculateStatusMetrics().shipped.value}</span>
            </div>
          </div>

          {/* Delivered Card */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-lg border border-green-100 p-4 transition-all duration-300 hover:shadow-xl hover:scale-105">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-green-100 rounded-lg p-2">
                <FaCheckCircle className="text-green-600 text-xl" />
              </div>
              <span className="text-green-600 text-sm font-medium px-2 py-1 bg-green-100 rounded-full">
                {calculateStatusMetrics().delivered.percentage}%
              </span>
            </div>
            <h3 className="text-2xl font-bold text-green-700 mb-1">
              {calculateStatusMetrics().delivered.count}
            </h3>
            <p className="text-green-600 font-medium mb-2">Delivered Orders</p>
            <div className="flex items-center text-green-800">
              <FaDollarSign className="mr-1" />
              <span className="text-sm">₹{calculateStatusMetrics().delivered.value}</span>
            </div>
          </div>

          {/* Cancelled Card */}
          <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl shadow-lg border border-red-100 p-4 transition-all duration-300 hover:shadow-xl hover:scale-105">
            <div className="flex items-center justify-between mb-3">
              <div className="bg-red-100 rounded-lg p-2">
                <FaBan className="text-red-600 text-xl" />
              </div>
              <span className="text-red-600 text-sm font-medium px-2 py-1 bg-red-100 rounded-full">
                {calculateStatusMetrics().cancelled.percentage}%
              </span>
            </div>
            <h3 className="text-2xl font-bold text-red-700 mb-1">
              {calculateStatusMetrics().cancelled.count}
            </h3>
            <p className="text-red-600 font-medium mb-2">Cancelled Orders</p>
            <div className="flex items-center text-red-800">
              <FaDollarSign className="mr-1" />
              <span className="text-sm">₹{calculateStatusMetrics().cancelled.value}</span>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors flex items-center justify-center"
          >
            {showAnalytics ? "Hide Analytics" : "Show Analytics"}
          </button>
        </div>

        {showAnalytics && <AnalyticsDashboard orders={orders} />}

        <div className="bg-white shadow-2xl rounded-xl overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gradient-to-r from-indigo-500/5 to-purple-500/5">
                  {/* Order ID Column */}
                  <th 
                    className="group px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("orderReference")}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Order ID</span>
                      <div className="transition-colors group-hover:bg-indigo-100 rounded p-1">
                        {sortField === "orderReference" ? (
                          sortDirection === "asc" ? <FaSortUp className="text-indigo-600" /> : <FaSortDown className="text-indigo-600" />
                        ) : <FaSort className="text-gray-400" />}
                      </div>
                    </div>
                  </th>

                  {/* Customer Column */}
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    <div className="flex items-center space-x-1">
                      <FaUser className="text-gray-400" />
                      <span>Customer</span>
                    </div>
                  </th>

                  {/* Date Column */}
                  <th 
                    className="group px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("createdAt")}
                  >
                    <div className="flex items-center space-x-1">
                      <FaCalendarAlt className="text-gray-400" />
                      <span>Date</span>
                      <div className="transition-colors group-hover:bg-indigo-100 rounded p-1">
                        {sortField === "createdAt" ? (
                          sortDirection === "asc" ? <FaSortUp className="text-indigo-600" /> : <FaSortDown className="text-indigo-600" />
                        ) : <FaSort className="text-gray-400" />}
                      </div>
                    </div>
                  </th>

                  {/* Total Column */}
                  <th 
                    className="group px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("totalPrice")}
                  >
                    <div className="flex items-center space-x-1">
                      <FaDollarSign className="text-gray-400" />
                      <span>Total</span>
                      <div className="transition-colors group-hover:bg-indigo-100 rounded p-1">
                        {sortField === "totalPrice" ? (
                          sortDirection === "asc" ? <FaSortUp className="text-indigo-600" /> : <FaSortDown className="text-indigo-600" />
                        ) : <FaSort className="text-gray-400" />}
                      </div>
                    </div>
                  </th>

                  {/* Status Column */}
                  <th 
                    className="group px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("orderStatus")}
                  >
                    <div className="flex items-center space-x-1">
                      <FaClipboardList className="text-gray-400" />
                      <span>Status</span>
                      <div className="transition-colors group-hover:bg-indigo-100 rounded p-1">
                        {sortField === "orderStatus" ? (
                          sortDirection === "asc" ? <FaSortUp className="text-indigo-600" /> : <FaSortDown className="text-indigo-600" />
                        ) : <FaSort className="text-gray-400" />}
                      </div>
                    </div>
                  </th>

                  {/* Actions Column */}
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    <span>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((order, index) => (
                    <tr 
                      key={order._id} 
                      className={`group hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 transition-colors
                        ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-indigo-600">#{order.orderReference}</span>
                          <div className="ml-2 px-2 py-1 bg-indigo-50 rounded-full">
                            <span className="text-xs text-indigo-600">{order.orderItems?.length || 0} items</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{order.userName}</span>
                          <span className="text-xs text-gray-500 flex items-center">
                            <FaEnvelope className="mr-1" /> {order.userEmail}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-900">{new Date(order.createdAt).toLocaleDateString()}</span>
                          <span className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-1">
                          <span className="text-sm font-bold text-gray-900">₹{order.totalPrice.toFixed(2)}</span>
                          {order.paymentMethod === 'cod' ? (
                            <span className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded-full">COD</span>
                          ) : (
                            <span className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded-full">PAID</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {editingOrder && editingOrder._id === order._id ? (
                          <div className="flex items-center space-x-2">
                            <select
                              value={order.orderStatus}
                              onChange={(e) => handleStatusChange(order._id, e.target.value)}
                              disabled={updatingStatus}
                              className="text-sm rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            >
                              {statusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {updatingStatus && (
                              <FaSpinner className="animate-spin text-indigo-600" />
                            )}
                          </div>
                        ) : (
                          <span 
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium shadow-sm
                              ${order.orderStatus === 'processing' ? 'bg-amber-100 text-amber-800' :
                                order.orderStatus === 'shipped' ? 'bg-blue-100 text-blue-800' :
                                order.orderStatus === 'delivered' ? 'bg-green-100 text-green-800' :
                                'bg-red-100 text-red-800'}`}
                          >
                            {order.orderStatus}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleViewOrderDetails(order)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <FaEye />
                          </button>
                          <button
                            onClick={() => setEditingOrder(order)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Edit Status"
                          >
                            <FaEdit />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <div className="rounded-full bg-gray-100/50 p-4 mb-4">
                          <FaSearch className="text-2xl text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium mb-2">No orders found</p>
                        <p className="text-gray-400 text-sm">Try adjusting your search or filter criteria</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showOrderDetails && (
          <OrderDetailsModal
            order={selectedOrderDetails}
            onClose={() => setShowOrderDetails(false)}
            onStatusChange={handleStatusChange}
            statusOptions={statusOptions}
            getStatusBadgeStyle={getStatusBadgeStyle}
            formatDate={formatDate}
            customers={customers}
          />
        )}
      </div>
    </>
  );
};

export default AdminOrdersPage;
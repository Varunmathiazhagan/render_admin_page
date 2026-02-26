import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import Navbar from "./Navbar";
import API_BASE_URL, { getAuthHeaders } from '../config';
// Import chart libraries
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, Filler } from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';
// Import file export library
import { CSVLink } from "react-csv";

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, Filler);

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds
const ITEMS_PER_PAGE = 10;
const CONTACTS_CACHE_KEY = 'admin_contacts_cache_v1';
const CONTACTS_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

const normalizeContactStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'pending') return 'new';
  if (normalized === 'in progress') return 'inprogress';
  if (normalized === 'complete') return 'completed';
  return ['new', 'inprogress', 'completed'].includes(normalized) ? normalized : 'new';
};

// Status badges component
const StatusBadge = ({ status }) => {
  const statusStyles = {
    new: "bg-green-100 text-green-800 border-green-200",
    inprogress: "bg-yellow-100 text-yellow-800 border-yellow-200",
    completed: "bg-blue-100 text-blue-800 border-blue-200"
  };
  
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${statusStyles[status] || "bg-gray-100 text-gray-800 border-gray-200"}`}>
      {status === "inprogress" ? "In Progress" : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// Improved skeleton loader component with Tailwind
const SkeletonRow = () => (
  <tr className="animate-pulse border-b border-gray-200">
    <td className="py-3 px-4"><div className="h-5 bg-gray-200 rounded w-4/5"></div></td>
    <td className="py-3 px-4"><div className="h-5 bg-gray-200 rounded w-11/12"></div></td>
    <td className="py-3 px-4"><div className="h-5 bg-gray-200 rounded w-2/3"></div></td>
    <td className="py-3 px-4"><div className="h-5 bg-gray-200 rounded w-4/5"></div></td>
    <td className="py-3 px-4"><div className="h-5 bg-gray-200 rounded w-full"></div></td>
  </tr>
);

const AdminContacts = () => {
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Search and filtering
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const searchInputRef = useRef(null);
  
  // Sorting
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [animateSorting, setAnimateSorting] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageTransition, setPageTransition] = useState(false);

  // New state for enhanced features
  const [selectedContact, setSelectedContact] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [contactStats, setContactStats] = useState({
    total: 0,
    new: 0,
    inprogress: 0,
    completed: 0,
    responseTime: 0
  });

  const fetchContacts = async (retry = false) => {
    // Try session cache first (skip on retry/refresh)
    if (!retry) {
      try {
        const cachedRaw = sessionStorage.getItem(CONTACTS_CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached?.timestamp && Array.isArray(cached?.data)) {
            if (Date.now() - cached.timestamp < CONTACTS_CACHE_TTL) {
              const normalizedContacts = cached.data.map((contact) => ({
                ...contact,
                status: normalizeContactStatus(contact.status),
              }));
              setContacts(normalizedContacts);
              setFilteredContacts(normalizedContacts);
              setTotalPages(Math.ceil(normalizedContacts.length / ITEMS_PER_PAGE));
              const stats = {
                total: normalizedContacts.length,
                new: normalizedContacts.filter(c => c.status === "new").length,
                inprogress: normalizedContacts.filter(c => c.status === "inprogress").length,
                completed: normalizedContacts.filter(c => c.status === "completed").length,
                responseTime: calculateAverageResponseTime(normalizedContacts)
              };
              setContactStats(stats);
              setLoading(false);
              setInitialLoading(false);
              return;
            }
          }
        }
      } catch (e) { console.warn('Contacts cache read error:', e); }
    }

    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/api/contacts`, {
        headers: getAuthHeaders(),
      });
      const rawData = Array.isArray(response.data) ? response.data : [];
      sessionStorage.setItem(CONTACTS_CACHE_KEY, JSON.stringify({ data: rawData, timestamp: Date.now() }));
      const normalizedContacts = rawData.map((contact) => ({
        ...contact,
        status: normalizeContactStatus(contact.status),
      }));
      setContacts(normalizedContacts);
      setFilteredContacts(normalizedContacts);
      setTotalPages(Math.ceil(normalizedContacts.length / ITEMS_PER_PAGE));
      
      // Calculate statistics for dashboard
      const stats = {
        total: normalizedContacts.length,
        new: normalizedContacts.filter(c => c.status === "new").length,
        inprogress: normalizedContacts.filter(c => c.status === "inprogress").length,
        completed: normalizedContacts.filter(c => c.status === "completed").length,
        responseTime: calculateAverageResponseTime(normalizedContacts)
      };
      setContactStats(stats);
      
      setRetryCount(0);
      // Delayed removal of initial loading state for smooth transition
      setTimeout(() => setInitialLoading(false), 500);
    } catch (err) {
      console.error('Fetch error:', err);
      const errorMessage = err.response
        ? `Error: ${err.response.status} - ${err.response.statusText}`
        : 'Failed to connect to the server';
      
      if (retry && retryCount < MAX_RETRIES) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => fetchContacts(true), RETRY_DELAY);
      } else {
        setError(`${errorMessage}. Please try again later.`);
        setInitialLoading(false);
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculate average response time from contact timestamps (hours)
  const calculateAverageResponseTime = (contacts) => {
    const resolvedContacts = contacts.filter(
      (contact) => contact.status === 'completed' || contact.status === 'inprogress'
    );
    if (resolvedContacts.length === 0) return 0;

    const now = Date.now();
    const totalHours = resolvedContacts.reduce((sum, contact) => {
      const createdAt = new Date(contact.createdAt).getTime();
      if (Number.isNaN(createdAt)) return sum;
      const hours = Math.max(0, (now - createdAt) / (1000 * 60 * 60));
      return sum + hours;
    }, 0);

    return Math.round(totalHours / resolvedContacts.length);
  };

  // Apply filters and search
  useEffect(() => {
    if (!contacts.length) return;
    
    let result = [...contacts];
    
    // Apply status filter
    if (activeFilter !== "all") {
      result = result.filter(contact => 
        contact.status.toLowerCase() === activeFilter.toLowerCase()
      );
    }
    
    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(contact => 
        contact.name.toLowerCase().includes(term) ||
        contact.email.toLowerCase().includes(term) ||
        contact.subject.toLowerCase().includes(term) ||
        contact.message.toLowerCase().includes(term)
      );
    }
    
    // Apply sorting
    result.sort((a, b) => {
      const aValue = a[sortField]?.toLowerCase() || '';
      const bValue = b[sortField]?.toLowerCase() || '';
      
      if (sortDirection === "asc") {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
    
    // Animate filtering changes
    setPageTransition(true);
    setTimeout(() => {
      setFilteredContacts(result);
      setTotalPages(Math.ceil(result.length / ITEMS_PER_PAGE));
      setCurrentPage(1);  // Reset to first page when filters change
      setPageTransition(false);
    }, 300);
    
  }, [contacts, searchTerm, activeFilter, sortField, sortDirection]);

  const handleSort = (field) => {
    setAnimateSorting(true);
    
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    
    // Reset animation state
    setTimeout(() => setAnimateSorting(false), 500);
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // Add focus animation to search input
  const handleSearchFocus = () => {
    searchInputRef.current.parentNode.classList.add('focused');
  };
  
  const handleSearchBlur = () => {
    searchInputRef.current.parentNode.classList.remove('focused');
  };

  // Get current page items
  const getCurrentPageItems = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredContacts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  };
  
  useEffect(() => {
    fetchContacts(true);
    
    // Add scroll animation when component mounts
    const contentContainer = document.querySelector('.content-container');
    if (contentContainer) {
      contentContainer.style.opacity = '0';
      contentContainer.style.transform = 'translateY(20px)';
      
      setTimeout(() => {
        contentContainer.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        contentContainer.style.opacity = '1';
        contentContainer.style.transform = 'translateY(0)';
      }, 100);
    }
    
    // Cleanup animation
    return () => {
      if (contentContainer) {
        contentContainer.style.transition = '';
        contentContainer.style.opacity = '';
        contentContainer.style.transform = '';
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Page change with animation
  const handlePageChange = (newPage) => {
    setPageTransition(true);
    setTimeout(() => {
      setCurrentPage(newPage);
      setPageTransition(false);
    }, 300);
  };

  // Handle changing contact status (persists to backend)
  const handleStatusChange = async (contactId, newStatus) => {
    // Optimistic update
    const updatedContacts = contacts.map(contact => 
      contact._id === contactId ? {...contact, status: newStatus} : contact
    );
    
    setContacts(updatedContacts);
    
    const stats = {
      total: updatedContacts.length,
      new: updatedContacts.filter(c => c.status === "new").length,
      inprogress: updatedContacts.filter(c => c.status === "inprogress").length,
      completed: updatedContacts.filter(c => c.status === "completed").length,
      responseTime: contactStats.responseTime
    };
    
    setContactStats(stats);
    
    if (showDetailModal && selectedContact && selectedContact._id === contactId) {
      setSelectedContact({...selectedContact, status: newStatus});
    }

    // Persist to backend
    try {
      await axios.put(`${API_BASE_URL}/api/contacts/${contactId}/status`, 
        { status: newStatus },
        { headers: { 'Content-Type': 'application/json', ...getAuthHeaders() } }
      );
      sessionStorage.removeItem(CONTACTS_CACHE_KEY); // Invalidate cache after status change
    } catch (error) {
      console.error("Failed to update contact status:", error);
      // Revert on failure
      fetchContacts();
    }
  };

  // View contact details
  const viewContactDetails = (contact) => {
    setSelectedContact(contact);
    setShowDetailModal(true);
  };

  // Chart data for status distribution
  const statusChartData = {
    labels: ['New', 'In Progress', 'Completed'],
    datasets: [
      {
        data: [contactStats.new, contactStats.inprogress, contactStats.completed],
        backgroundColor: [
          'rgba(52, 211, 153, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(59, 130, 246, 0.8)'
        ],
        borderColor: [
          'rgba(52, 211, 153, 1)',
          'rgba(251, 191, 36, 1)',
          'rgba(59, 130, 246, 1)'
        ],
        borderWidth: 1,
      },
    ],
  };

  // Chart data for contact trends (based on DB records)
  const trendChartData = {
    labels: Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    }),
    datasets: [
      {
        fill: true,
        label: 'Contacts',
        data: Array.from({ length: 7 }, (_, i) => {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          start.setDate(start.getDate() - (6 - i));
          const end = new Date(start);
          end.setDate(end.getDate() + 1);

          return contacts.filter((contact) => {
            if (!contact.createdAt) return false;
            const created = new Date(contact.createdAt);
            return created >= start && created < end;
          }).length;
        }),
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.4
      }
    ]
  };

  // CSV export data preparation
  const csvData = [
    ["Name", "Email", "Phone", "Subject", "Message", "Status"],
    ...filteredContacts.map(contact => [
      contact.name,
      contact.email,
      contact.phone,
      contact.subject,
      contact.message,
      contact.status
    ])
  ];

  const totalEntries = filteredContacts.length;
  const showingStart = totalEntries ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const showingEnd = Math.min(currentPage * ITEMS_PER_PAGE, totalEntries);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all duration-300 ease-in-out">
        <div className="flex flex-col md:flex-row justify-between items-start mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 md:mb-0">
            Contact Management Dashboard
          </h2>
          
          <div className="flex space-x-2">
            <CSVLink 
              data={csvData}
              filename={"contacts-export.csv"}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md shadow-sm transition duration-150 ease-in-out flex items-center space-x-1"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span>Export CSV</span>
            </CSVLink>
            
            <button 
              onClick={() => fetchContacts(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm transition duration-150 ease-in-out flex items-center space-x-1"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>
        
        {/* Dashboard Stats and Charts */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Stat Cards */}
          <div className="bg-white rounded-xl shadow p-5 transform transition-transform duration-300 hover:scale-105">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm">Total Contacts</p>
                <h3 className="text-2xl font-bold text-gray-800">{contactStats.total}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <span className="text-gray-500">All time contacts</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-5 transform transition-transform duration-300 hover:scale-105">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm">New Contacts</p>
                <h3 className="text-2xl font-bold text-green-600">{contactStats.new}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <span className="text-green-600 font-medium">{Math.round((contactStats.new / contactStats.total) * 100) || 0}%</span>
              <span className="text-gray-500 ml-1">of total contacts</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-5 transform transition-transform duration-300 hover:scale-105">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm">In Progress</p>
                <h3 className="text-2xl font-bold text-yellow-500">{contactStats.inprogress}</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <span className="text-yellow-600 font-medium">{Math.round((contactStats.inprogress / contactStats.total) * 100) || 0}%</span>
              <span className="text-gray-500 ml-1">of total contacts</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-5 transform transition-transform duration-300 hover:scale-105">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm">Avg. Response Time</p>
                <h3 className="text-2xl font-bold text-blue-600">{contactStats.responseTime}h</h3>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
            </div>
            <div className="mt-2 flex items-center text-sm">
              <span className="text-gray-500">From new to completed</span>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Contact Status Distribution</h3>
            <div className="h-64 flex items-center justify-center">
              <div className="w-2/3">
                <Pie data={statusChartData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Weekly Contact Trends</h3>
            <div className="h-64">
              <Line 
                data={trendChartData} 
                options={{
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.05)'
                      }
                    },
                    x: {
                      grid: {
                        display: false
                      }
                    }
                  },
                  plugins: {
                    legend: {
                      display: false
                    }
                  }
                }} 
              />
            </div>
          </div>
        </div>
        
        <h3 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
          Contact List
        </h3>
        
        <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300">
          {initialLoading ? (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-600"></div>
              <div className="text-gray-600 font-medium">Loading your contacts...</div>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <div className="bg-red-50 rounded-lg p-6 mb-4">
                <p className="text-red-600 mb-3">{error}</p>
                <button 
                  onClick={() => fetchContacts(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="sm:flex justify-between p-4 border-b border-gray-200 space-y-4 sm:space-y-0">
                <div className="relative w-full sm:w-64 md:w-80">
                  <div className={`flex items-center bg-gray-100 rounded-lg px-3 py-2 transition-all duration-200 ${searchTerm ? 'ring-2 ring-indigo-500' : ''}`}>
                    <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                    <input 
                      ref={searchInputRef}
                      type="text" 
                      className="ml-2 flex-1 bg-transparent outline-none text-gray-700 placeholder-gray-500" 
                      placeholder="Search by name, email or subject..." 
                      value={searchTerm}
                      onChange={handleSearch}
                      onFocus={handleSearchFocus}
                      onBlur={handleSearchBlur}
                    />
                  </div>
                </div>
                
                <div className="flex space-x-2 overflow-x-auto pb-2">
                  <button 
                    onClick={() => handleFilterChange("all")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-150 
                      ${activeFilter === "all" 
                        ? "bg-indigo-600 text-white shadow-md" 
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    All Contacts
                  </button>
                  <button 
                    onClick={() => handleFilterChange("new")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-150
                      ${activeFilter === "new" 
                        ? "bg-green-600 text-white shadow-md" 
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    New
                  </button>
                  <button 
                    onClick={() => handleFilterChange("inprogress")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-150
                      ${activeFilter === "inprogress" 
                        ? "bg-yellow-500 text-white shadow-md" 
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    In Progress
                  </button>
                  <button 
                    onClick={() => handleFilterChange("completed")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-150
                      ${activeFilter === "completed" 
                        ? "bg-blue-600 text-white shadow-md" 
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                  >
                    Completed
                  </button>
                </div>
              </div>
              
              {filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                  <svg className="h-16 w-16 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                  </svg>
                  <div className="mb-4 text-lg font-medium">No contacts found matching your search criteria</div>
                  <button 
                    onClick={() => {setSearchTerm(''); setActiveFilter('all');}}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm transition duration-150 ease-in-out"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className={`w-full ${animateSorting ? 'opacity-70' : 'opacity-100'} ${pageTransition ? 'opacity-50' : 'opacity-100'} transition-opacity duration-300`}>
                    <thead className="bg-gray-50 text-left">
                      <tr>
                        <th 
                          onClick={() => handleSort("name")}
                          className={`px-4 py-3 text-sm font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors duration-150 whitespace-nowrap ${sortField === "name" ? "text-indigo-600" : ""}`}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Name</span>
                            {sortField === "name" && (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                  d={sortDirection === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}></path>
                              </svg>
                            )}
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort("email")}
                          className={`px-4 py-3 text-sm font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors duration-150 whitespace-nowrap ${sortField === "email" ? "text-indigo-600" : ""}`}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Email</span>
                            {sortField === "email" && (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                  d={sortDirection === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}></path>
                              </svg>
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500 uppercase whitespace-nowrap">Phone</th>
                        <th 
                          onClick={() => handleSort("subject")}
                          className={`px-4 py-3 text-sm font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors duration-150 whitespace-nowrap ${sortField === "subject" ? "text-indigo-600" : ""}`}
                        >
                          <div className="flex items-center space-x-1">
                            <span>Subject</span>
                            {sortField === "subject" && (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                  d={sortDirection === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}></path>
                              </svg>
                            )}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500 uppercase whitespace-nowrap">Status</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500 uppercase whitespace-nowrap text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        // Skeleton loading rows
                        Array(5).fill().map((_, i) => <SkeletonRow key={`skeleton-${i}`} />)
                      ) : (
                        <TransitionGroup component={null}>
                          {getCurrentPageItems().map((contact) => (
                            <CSSTransition
                              key={contact._id}
                              timeout={500}
                              classNames={{
                                enter: 'opacity-0',
                                enterActive: 'opacity-100 transition-opacity duration-300',
                                exit: 'opacity-0 transition-opacity duration-300'
                              }}
                            >
                              <tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150">
                                <td className="px-4 py-3 text-sm text-gray-900">{contact.name}</td>
                                <td className="px-4 py-3 text-sm text-gray-900">{contact.email}</td>
                                <td className="px-4 py-3 text-sm text-gray-900">{contact.phone}</td>
                                <td className="px-4 py-3 text-sm text-gray-900">{contact.subject}</td>
                                <td className="px-4 py-3 text-sm">
                                  <StatusBadge status={contact.status || "new"} />
                                </td>
                                <td className="px-4 py-3 text-sm text-right">
                                  <div className="flex justify-end space-x-2">
                                    <button
                                      onClick={() => viewContactDetails(contact)}
                                      className="p-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
                                      title="View Details"
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                      </svg>
                                    </button>
                                    <div className="relative group">
                                      <button
                                        className="p-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition-colors"
                                        title="Change Status"
                                      >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                        </svg>
                                      </button>
                                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                                        <div className="py-1">
                                          <button 
                                            onClick={() => handleStatusChange(contact._id, "new")}
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                          >
                                            Set as New
                                          </button>
                                          <button 
                                            onClick={() => handleStatusChange(contact._id, "inprogress")}
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                          >
                                            Mark In Progress
                                          </button>
                                          <button 
                                            onClick={() => handleStatusChange(contact._id, "completed")}
                                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                          >
                                            Mark as Completed
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            </CSSTransition>
                          ))}
                        </TransitionGroup>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              
              {filteredContacts.length > 0 && (
                <div className="px-4 py-3 flex flex-col sm:flex-row justify-between items-center border-t border-gray-200">
                  <div className="text-sm text-gray-500 mb-4 sm:mb-0">
                    Showing <span className="font-medium text-gray-700">{showingStart}</span> to <span className="font-medium text-gray-700">{showingEnd}</span> of <span className="font-medium text-gray-700">{totalEntries}</span> entries
                  </div>
                  <div className="inline-flex rounded-md shadow-sm">
                    <button 
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                    >
                      <span className="sr-only">First</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                      </svg>
                    </button>
                    <button 
                      className="relative inline-flex items-center px-2 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <span className="sr-only">Previous</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button 
                          key={i}
                          className={`relative inline-flex items-center px-4 py-2 border-t border-b border-gray-300 text-sm font-medium transition-colors duration-150
                            ${currentPage === pageNum 
                              ? "bg-indigo-600 text-white z-10 border-indigo-600" 
                              : "bg-white text-gray-700 hover:bg-gray-50"}`}
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button 
                      className="relative inline-flex items-center px-2 py-2 border-t border-b border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button 
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      <span className="sr-only">Last</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Contact Detail Modal */}
      {showDetailModal && selectedContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Contact Details</h3>
                <button 
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm font-medium text-gray-500">Name</p>
                  <p className="mt-1 text-sm text-gray-900">{selectedContact.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="mt-1 text-sm text-gray-900">{selectedContact.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p className="mt-1 text-sm text-gray-900">{selectedContact.phone}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <div className="mt-1"><StatusBadge status={selectedContact.status || "new"} /></div>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-500">Subject</p>
                <p className="mt-1 text-sm text-gray-900">{selectedContact.subject}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-500">Message</p>
                <div className="mt-1 p-4 bg-gray-50 rounded-md text-sm text-gray-900">
                  {selectedContact.message}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-between">
              <div className="flex space-x-2">
                <button 
                  onClick={() => handleStatusChange(selectedContact._id, "new")}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${selectedContact.status === "new" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  New
                </button>
                <button 
                  onClick={() => handleStatusChange(selectedContact._id, "inprogress")}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${selectedContact.status === "inprogress" ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  In Progress
                </button>
                <button 
                  onClick={() => handleStatusChange(selectedContact._id, "completed")}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${selectedContact.status === "completed" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  Completed
                </button>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminContacts;

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import AdminHome from './components/admin_home';
import AddProduct from './components/AddProduct';
import ManageProducts from './components/ManageProducts';
import AdminContacts from './components/contact';
import Login from './components/Login';
import User from './components/user';
import AdminOrdersPage from './components/order'; // Fix component name to match export
import Employee from './components/Employee';

const MAX_SESSION_TIME = 8 * 60 * 60 * 1000; // 8 hours in milliseconds

const checkAuth = () => {
  const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
  const loginTime = parseInt(sessionStorage.getItem('loginTime') || '0');
  const token = sessionStorage.getItem('token');
  const currentTime = new Date().getTime();
  
  // Log auth status for debugging
  console.log("Auth check:", { 
    isAuthenticated, 
    token: token ? "exists" : "missing",
    loginTime,
    currentTime,
    expired: currentTime - loginTime > MAX_SESSION_TIME
  });
  
  if (!isAuthenticated || !loginTime || !token || (currentTime - loginTime > MAX_SESSION_TIME)) {
    console.log("Auth check failed, clearing session");
    sessionStorage.clear();
    return false;
  }
  
  console.log("Auth check passed");
  return true;
};

const logout = (navigate) => {
  sessionStorage.clear();
  navigate('/login', { replace: true });
};

const PrivateRoute = ({ children }) => {
  const navigate = useNavigate();
  
  React.useEffect(() => {
    if (!checkAuth()) {
      logout(navigate);
    }
  }, [navigate]);

  if (!checkAuth()) {
    return null;
  }
  
  return children; // Remove the logout button that might interfere with navbar
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/login" element={
            checkAuth() ? <Navigate to="/" replace /> : <Login />
          } />
          <Route path="/" element={
            <PrivateRoute>
              <AdminHome />
            </PrivateRoute>
          } />
          <Route path="/add-product" element={
            <PrivateRoute>
              <AddProduct />
            </PrivateRoute>
          } />
          <Route path="/manage-products" element={
            <PrivateRoute>
              <ManageProducts />
            </PrivateRoute>
          } />
          <Route path="/contacts" element={
            <PrivateRoute>
              <AdminContacts />
            </PrivateRoute>
          } />
          <Route path="/users" element={
            <PrivateRoute>
              <User />
            </PrivateRoute>
          } />
          <Route path="/orders" element={
            <PrivateRoute>
              <AdminOrdersPage /> {/* Use the correct component name */}
            </PrivateRoute>
          } />
          <Route path="/employees" element={<Employee />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

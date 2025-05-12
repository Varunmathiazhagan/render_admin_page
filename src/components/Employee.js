import React, { useEffect, useState, useCallback } from "react";
import Navbar from "./Navbar";

const API_URL = "http://localhost:5000/api/employees";
const EXPENSE_API_URL = "http://localhost:5000/api/expenses";

const defaultForm = {
  name: "",
  email: "",
  phone: "",
  position: "",
  department: "",
  joiningDate: "",
  salary: "",
  address: "",
  status: "active"
};

const defaultExpenseForm = {
  title: "",
  amount: "",
  date: ""
};

const Employee = () => {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("joiningDate");
  const [sortDir, setSortDir] = useState("desc");
  const [showForm, setShowForm] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [expenseForm, setExpenseForm] = useState(defaultExpenseForm);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: "", type: "" });
  const [activeTab, setActiveTab] = useState("employees");

  // Show notification helper function
  const showNotification = (message, type = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: "", type: "" }), 3000);
  };

  // Memoize fetch functions with useCallback
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching employees:", err);
      showNotification("Failed to load employees", "error");
    } finally {
      setLoading(false);
    }
  }, []);  // Empty dependency array as these don't depend on props or state

  const fetchExpenses = useCallback(async () => {
    setExpenseLoading(true);
    try {
      const res = await fetch(EXPENSE_API_URL);
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching expenses:", err);
      showNotification("Failed to load expenses", "error");
    } finally {
      setExpenseLoading(false);
    }
  }, []);  // Empty dependency array as these don't depend on props or state

  // Note: showNotification is used in fetchEmployees and fetchExpenses
  // but will be stable between renders since we don't modify its reference
  
  useEffect(() => { 
    fetchEmployees(); 
  }, [fetchEmployees]);
  
  useEffect(() => { 
    fetchExpenses(); 
  }, [fetchExpenses]);

  const handleInput = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleExpenseInput = e => {
    const { name, value } = e.target;
    setExpenseForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    const method = editingId ? "PUT" : "POST";
    const url = editingId ? `${API_URL}/${editingId}` : API_URL;

    try {
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form)
        });

        if (!res.ok) {
            const errorData = await res.json();
            console.error("Error:", errorData);
            showNotification(errorData.error || "Failed to save employee", "error");
            return;
        }

        await fetchEmployees();
        setForm(defaultForm);
        setEditingId(null);
        setShowForm(false);
        showNotification(editingId ? "Employee updated successfully" : "Employee added successfully");
    } catch (err) {
        console.error("Request failed:", err);
        showNotification("An error occurred while saving the employee.", "error");
    } finally {
        setLoading(false);
    }
  };

  const handleExpenseSubmit = async e => {
    e.preventDefault();
    setExpenseLoading(true);
    try {
      const res = await fetch(EXPENSE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expenseForm)
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error("Error adding expense:", errorData);
        showNotification(errorData.error || "Failed to save expense", "error");
        return;
      }

      await fetchExpenses();
      setExpenseForm(defaultExpenseForm);
      setShowExpenseForm(false);
      showNotification("Expense added successfully");
    } catch (err) {
      console.error("Request failed:", err);
      showNotification("An error occurred while saving the expense.", "error");
    } finally {
      setExpenseLoading(false);
    }
  };

  const handleEdit = emp => {
    setForm({
      name: emp.name,
      email: emp.email,
      phone: emp.phone || "",
      position: emp.position,
      department: emp.department || "",
      joiningDate: emp.joiningDate ? emp.joiningDate.slice(0, 10) : "",
      salary: emp.salary || "",
      address: emp.address || "",
      status: emp.status || "active"
    });
    setEditingId(emp._id);
    setShowForm(true);
  };

  const handleDelete = async id => {
    if (!window.confirm("Delete this employee?")) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchEmployees();
        showNotification("Employee deleted successfully");
      } else {
        showNotification("Failed to delete employee", "error");
      }
    } catch (err) {
      console.error("Delete request failed:", err);
      showNotification("An error occurred while deleting", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleExpenseDelete = async id => {
    if (!window.confirm("Delete this expense?")) return;
    setExpenseLoading(true);
    try {
      const res = await fetch(`${EXPENSE_API_URL}/${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchExpenses();
        showNotification("Expense deleted successfully");
      } else {
        showNotification("Failed to delete expense", "error");
      }
    } catch (err) {
      console.error("Delete request failed:", err);
      showNotification("An error occurred while deleting", "error");
    } finally {
      setExpenseLoading(false);
    }
  };

  const filtered = employees
    .filter(e =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      (e.position && e.position.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (sortKey === "joiningDate") {
        av = new Date(av); bv = new Date(bv);
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Notification */}
        {notification.show && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg transition-all duration-500 transform translate-y-0 
            ${notification.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
            {notification.message}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-6">
            <button
              className={`pb-3 px-1 ${activeTab === 'employees' 
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'} transition-colors duration-200`}
              onClick={() => setActiveTab('employees')}
            >
              Employees
            </button>
            <button
              className={`pb-3 px-1 ${activeTab === 'expenses' 
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'} transition-colors duration-200`}
              onClick={() => setActiveTab('expenses')}
            >
              Expenses
            </button>
          </nav>
        </div>

        {/* Employee Management Section */}
        <div className={activeTab === 'employees' ? 'block' : 'hidden'}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold text-gray-900">Employee Management</h2>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={() => { setShowForm(true); setForm(defaultForm); setEditingId(null); }}
            >
              Add Employee
            </button>
          </div>
          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Search by name, email, or position"
                className="border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full px-4 py-2 rounded-md shadow-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="flex gap-2 sm:w-auto">
              <select
                className="border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={sortKey}
                onChange={e => setSortKey(e.target.value)}
              >
                <option value="joiningDate">Joining Date</option>
                <option value="name">Name</option>
                <option value="position">Position</option>
                <option value="department">Department</option>
                <option value="salary">Salary</option>
                <option value="status">Status</option>
              </select>
              <select
                className="border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={sortDir}
                onChange={e => setSortDir(e.target.value)}
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex justify-center items-center p-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joining Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Salary</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center px-6 py-4 whitespace-nowrap text-sm text-gray-500">No employees found.</td>
                      </tr>
                    ) : filtered.map(emp => (
                      <tr key={emp._id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{emp.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.phone}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.position}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.department}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : ""}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.salary ? `₹${emp.salary}` : ""}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${
                            emp.status === "active" ? "bg-green-100 text-green-800"
                              : emp.status === "inactive" ? "bg-gray-100 text-gray-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}>
                            {emp.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            className="text-blue-600 hover:text-blue-900 mr-4 transition-colors duration-200"
                            onClick={() => handleEdit(emp)}
                          >
                            Edit
                          </button>
                          <button 
                            className="text-red-600 hover:text-red-900 transition-colors duration-200"
                            onClick={() => handleDelete(emp._id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Expenses Section */}
        <div className={activeTab === 'expenses' ? 'block' : 'hidden'}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-2xl font-bold text-gray-900">Expense Management</h2>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={() => { setShowExpenseForm(true); setExpenseForm(defaultExpenseForm); }}
            >
              Add Expense
            </button>
          </div>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              {expenseLoading ? (
                <div className="flex justify-center items-center p-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {expenses.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center px-6 py-4 whitespace-nowrap text-sm text-gray-500">No expenses found.</td>
                      </tr>
                    ) : expenses.map(exp => (
                      <tr key={exp._id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{exp.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{exp.amount}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(exp.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                            className="text-red-600 hover:text-red-900 transition-colors duration-200"
                            onClick={() => handleExpenseDelete(exp._id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
        
        {/* Employee Form Modal */}
        {showForm && (
          <div className="fixed inset-0 overflow-y-auto z-50">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowForm(false)}></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full px-4 pt-5 pb-4 sm:p-6">
                <div className="absolute top-0 right-0 pt-4 pr-4">
                  <button
                    type="button"
                    className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={() => setShowForm(false)}
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <form onSubmit={handleSubmit}>
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-5">{editingId ? "Edit Employee" : "Add Employee"}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
                      <input 
                        id="name" 
                        name="name" 
                        value={form.name} 
                        onChange={handleInput} 
                        required 
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                      <input 
                        id="email" 
                        name="email" 
                        type="email" 
                        value={form.email} 
                        onChange={handleInput} 
                        required 
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
                      <input 
                        id="phone" 
                        name="phone" 
                        value={form.phone} 
                        onChange={handleInput} 
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label htmlFor="position" className="block text-sm font-medium text-gray-700">Position</label>
                      <input 
                        id="position" 
                        name="position" 
                        value={form.position} 
                        onChange={handleInput} 
                        required 
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label htmlFor="department" className="block text-sm font-medium text-gray-700">Department</label>
                      <input 
                        id="department" 
                        name="department" 
                        value={form.department} 
                        onChange={handleInput} 
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label htmlFor="joiningDate" className="block text-sm font-medium text-gray-700">Joining Date</label>
                      <input 
                        id="joiningDate" 
                        name="joiningDate" 
                        type="date" 
                        value={form.joiningDate} 
                        onChange={handleInput} 
                        required 
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label htmlFor="salary" className="block text-sm font-medium text-gray-700">Salary</label>
                      <input 
                        id="salary" 
                        name="salary" 
                        type="number" 
                        min="0"
                        value={form.salary} 
                        onChange={handleInput} 
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                      <select 
                        id="status" 
                        name="status" 
                        value={form.status} 
                        onChange={handleInput} 
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="on leave">On Leave</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700">Address</label>
                    <textarea 
                      id="address" 
                      name="address" 
                      value={form.address} 
                      onChange={handleInput} 
                      rows="2"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                    ></textarea>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                    <button
                      type="button"
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                      onClick={() => setShowForm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm"
                      disabled={loading}
                    >
                      {loading ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </span>
                      ) : editingId ? "Update" : "Add"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Expense Form Modal */}
        {showExpenseForm && (
          <div className="fixed inset-0 overflow-y-auto z-50">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowExpenseForm(false)}></div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full px-4 pt-5 pb-4 sm:p-6">
                <div className="absolute top-0 right-0 pt-4 pr-4">
                  <button
                    type="button"
                    className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onClick={() => setShowExpenseForm(false)}
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <form onSubmit={handleExpenseSubmit}>
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-5">Add Expense</h3>
                  <div className="space-y-4 mb-5">
                    <div>
                      <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
                      <input 
                        id="title" 
                        name="title" 
                        value={expenseForm.title} 
                        onChange={handleExpenseInput} 
                        required 
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Amount (₹)</label>
                      <input 
                        id="amount" 
                        name="amount" 
                        type="number" 
                        min="0"
                        value={expenseForm.amount} 
                        onChange={handleExpenseInput} 
                        required 
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                      />
                    </div>
                    <div>
                      <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date</label>
                      <input 
                        id="date" 
                        name="date" 
                        type="date" 
                        value={expenseForm.date} 
                        onChange={handleExpenseInput} 
                        required 
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                      />
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                    <button
                      type="button"
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                      onClick={() => setShowExpenseForm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm"
                      disabled={expenseLoading}
                    >
                      {expenseLoading ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </span>
                      ) : "Add Expense"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Employee;

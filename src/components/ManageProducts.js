import React, { useState, useEffect, useRef } from "react";
import Navbar from "./Navbar";
import { Package, X, Edit2, Trash2, Plus, Star, DollarSign, Tag, Box, Loader, AlertCircle, ChevronRight } from "lucide-react";
import API_BASE_URL, { getAuthHeaders } from '../config';

const PRODUCTS_CACHE_KEY = 'admin_products_cache_v1';
const PRODUCTS_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

const ManageProducts = () => {
  const [products, setProducts] = useState([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    rating: "",
    stock: "",
    image: null,
  });
  const [loading, setLoading] = useState(true);
  const [isScrollable, setIsScrollable] = useState(false);
  const tableWrapperRef = useRef(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchProducts();
    
    // Check if table is scrollable
    const checkScrollable = () => {
      if (tableWrapperRef.current) {
        setIsScrollable(tableWrapperRef.current.scrollWidth > tableWrapperRef.current.clientWidth);
      }
    };
    
    // Initial check
    checkScrollable();
    
    // Listen for window resize
    window.addEventListener('resize', checkScrollable);
    
    return () => {
      window.removeEventListener('resize', checkScrollable);
    };
  }, []);

  // Update scroll check when products load
  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        if (tableWrapperRef.current) {
          setIsScrollable(tableWrapperRef.current.scrollWidth > tableWrapperRef.current.clientWidth);
        }
      }, 100);
    }
  }, [loading, products]);

  const fetchProducts = async (forceRefresh = false) => {
    // Try session cache first
    if (!forceRefresh) {
      try {
        const cachedRaw = sessionStorage.getItem(PRODUCTS_CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached?.timestamp && Array.isArray(cached?.data)) {
            if (Date.now() - cached.timestamp < PRODUCTS_CACHE_TTL) {
              setProducts(cached.data);
              setLoading(false);
              return;
            }
          }
        }
      } catch (e) { console.warn('Products cache read error:', e); }
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/products`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setProducts(data);
        sessionStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
      } else {
        throw new Error("Invalid data format received");
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      setProducts([]);
      alert(`Error fetching products: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const form = new FormData();
      form.append("name", formData.name);
      form.append("description", formData.description);
      form.append("price", formData.price);
      form.append("category", formData.category);
      form.append("rating", formData.rating);
      form.append("stock", formData.stock);

      // Append image only if a new file was selected
      if (formData.image instanceof File) {
        form.append("image", formData.image);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/admin/products/${editingProduct._id}`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: form,
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update product");
      }

      alert("Product updated successfully!");
      setIsEditModalOpen(false);
      sessionStorage.removeItem(PRODUCTS_CACHE_KEY);
      fetchProducts(true);
    } catch (error) {
      console.error("Update error:", error);
      alert("Error updating product: " + error.message);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const form = new FormData();
      form.append("name", formData.name);
      form.append("description", formData.description);
      form.append("price", formData.price);
      form.append("category", formData.category);
      form.append("rating", formData.rating);
      form.append("stock", formData.stock);

      // Append image only if a file was selected
      if (formData.image instanceof File) {
        form.append("image", formData.image);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/admin/products`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: form,
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to add product");
      }

      alert("Product added successfully!");
      setIsAddModalOpen(false);
      sessionStorage.removeItem(PRODUCTS_CACHE_KEY);
      fetchProducts(true);
    } catch (error) {
      console.error("Add product error:", error);
      setErrorMessage(`Error adding product: ${error.message}`);
      alert("Error adding product: " + error.message);
    }
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files && files[0] ? files[0] : value,
    }));
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      rating: product.rating,
      stock: product.stock,
      image: product.image, // initially a string; will change to a File if updated
    });
    setIsEditModalOpen(true);
    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden';
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    // Re-enable body scrolling
    document.body.style.overflow = 'auto';
  };

  const openAddModal = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      category: "",
      rating: "",
      stock: "",
      image: null,
    });
    setIsAddModalOpen(true);
    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden';
  };
  
  const closeAddModal = () => {
    setIsAddModalOpen(false);
    // Re-enable body scrolling
    document.body.style.overflow = 'auto';
  };

  const deleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/products/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete product");
      }
      alert("Product deleted successfully!");
      sessionStorage.removeItem(PRODUCTS_CACHE_KEY);
      fetchProducts(true);
    } catch (error) {
      console.error("Delete error:", error);
      alert(`Error deleting product: ${error.message}`);
    }
  };

  // Helper function to determine stock class using Tailwind
  const getStockClass = (stock) => {
    if (stock <= 0) return "text-red-600 font-medium";
    if (stock <= 10) return "text-amber-600 font-medium";
    return "text-green-600 font-medium";
  };

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <Package size={48} className="mb-4 opacity-50" />
      <h3 className="text-lg font-semibold mb-2">No products available</h3>
      <p className="text-sm">Add your first product to get started with inventory management</p>
    </div>
  );

  const renderLoadingState = () => (
    <div className="flex flex-col items-center justify-center py-8">
      <Loader size={36} className="animate-spin text-indigo-500 mb-4" />
      <p className="text-gray-600">Loading products...</p>
    </div>
  );

  return (
    <>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h2 className="text-xl font-bold flex items-center text-gray-900">
            <Package size={22} className="mr-2" />
            Manage Products
          </h2>
          <button 
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md flex items-center justify-center"
            onClick={openAddModal}
          >
            <Plus size={18} className="mr-2" /> Add New Product
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Table View for Desktop/Tablet - improve mobile experience */}
          <div className="overflow-x-auto relative" ref={tableWrapperRef}>
            {isScrollable && (
              <div className="absolute right-2 top-2 sm:right-4 sm:top-4 bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-600 text-xs py-1 px-2 rounded-full flex items-center">
                <span className="hidden xs:inline">Scroll to see more</span> <ChevronRight size={14} className="ml-1" />
              </div>
            )}
            <table className="w-full text-left">
              <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 text-xs uppercase text-gray-700">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3">ID</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3">Product</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3">Description</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3">Category</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3">Price</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3">Stock</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3">Rating</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-4 py-3">
                      {renderLoadingState()}
                    </td>
                  </tr>
                ) : products.length > 0 ? (
                  products.map((product) => (
                    <tr key={product._id} className="hover:bg-blue-50/30">
                      <td className="px-4 py-3 text-sm">#{product.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <img
                            src={product.image} // Ensure the Base64 image is used directly
                            alt={product.name}
                            className="w-10 h-10 rounded-full object-cover mr-3"
                          />
                          <span className="font-medium text-gray-900">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-600 max-w-xs truncate">
                          {product.description}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 text-indigo-600">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        ₹{Number(product.price).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={getStockClass(product.stock)}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center text-amber-500">
                          <Star size={14} fill="#F59F00" stroke="#F59F00" className="mr-1" />
                          {product.rating}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => openEditModal(product)} 
                            className="p-1.5 bg-gradient-to-r from-blue-100 to-indigo-100 text-indigo-600 rounded-md hover:from-blue-200 hover:to-indigo-200 transition-colors flex items-center"
                          >
                            <Edit2 size={14} className="mr-1" />
                            <span className="text-xs">Edit</span>
                          </button>
                          <button 
                            onClick={() => deleteProduct(product._id)} 
                            className="p-1.5 bg-gradient-to-r from-red-100 to-rose-100 text-red-600 rounded-md hover:from-red-200 hover:to-rose-200 transition-colors flex items-center"
                          >
                            <Trash2 size={14} className="mr-1" />
                            <span className="text-xs">Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="px-4 py-3">
                      {renderEmptyState()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Card View for Mobile - improve layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 sm:p-4 md:hidden">
            {loading ? (
              renderLoadingState()
            ) : products.length > 0 ? (
              products.map((product) => (
                <div className="bg-gradient-to-br from-white to-blue-50 rounded-lg p-3 sm:p-4 shadow-sm" key={product._id}>
                  <div className="flex items-start gap-2 sm:gap-3 mb-3">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-md object-cover shadow-sm" 
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-gray-900 text-sm sm:text-base truncate">{product.name}</h3>
                      <div className="flex items-center text-amber-500 mt-1">
                        <Star size={14} fill="#F59F00" stroke="#F59F00" className="mr-1" />
                        {product.rating}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4 text-xs sm:text-sm">
                    <p className="flex justify-between">
                      <span className="text-gray-500">ID:</span>
                      <span className="text-gray-900">#{product.id}</span>
                    </p>
                    <p className="text-gray-500">
                      <span>Description:</span>
                      <span className="block text-gray-900 mt-1 text-xs sm:text-sm line-clamp-2">
                        {product.description}
                      </span>
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <p className="flex items-center">
                        <Tag size={12} className="mr-1 text-gray-500" /> 
                        <span className="px-1.5 py-0.5 text-xs rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 text-indigo-600 truncate">
                          {product.category}
                        </span>
                      </p>
                      <p className="flex items-center justify-end">
                        <DollarSign size={12} className="mr-1 text-gray-500" />
                        <span className="font-medium text-gray-900">
                          ₹{Number(product.price).toLocaleString()}
                        </span>
                      </p>
                      <p className="flex items-center">
                        <Box size={12} className="mr-1 text-gray-500" />
                        <span className={getStockClass(product.stock)}>
                          {product.stock}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => openEditModal(product)} 
                      className="flex-1 py-1.5 sm:py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded hover:from-blue-600 hover:to-indigo-700 transition-colors flex items-center justify-center text-xs sm:text-sm shadow-sm"
                    >
                      <Edit2 size={14} className="mr-1 sm:mr-2" />
                      <span>Edit</span>
                    </button>
                    <button 
                      onClick={() => deleteProduct(product._id)} 
                      className="flex-1 py-1.5 sm:py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded hover:from-red-600 hover:to-rose-700 transition-colors flex items-center justify-center text-xs sm:text-sm shadow-sm"
                    >
                      <Trash2 size={14} className="mr-1 sm:mr-2" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              renderEmptyState()
            )}
          </div>
        </div>

        {/* Edit Product Modal - improve for mobile */}
        {isEditModalOpen && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-auto">
              <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Edit2 size={18} className="mr-2" /> Edit Product
                </h3>
                <button 
                  className="text-gray-500 hover:text-gray-700" 
                  onClick={closeEditModal}
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleEditSubmit} className="p-4 sm:p-6">
                <div className="mb-4">
                  <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input 
                    id="edit-name"
                    type="text" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleChange} 
                    required 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea 
                    id="edit-description"
                    name="description" 
                    value={formData.description} 
                    onChange={handleChange} 
                    required 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 h-24"
                  ></textarea>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="edit-price" className="block text-sm font-medium text-gray-700 mb-1">
                      Price
                    </label>
                    <input 
                      id="edit-price"
                      type="number" 
                      name="price" 
                      value={formData.price} 
                      onChange={handleChange} 
                      required 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-category" className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <input 
                      id="edit-category"
                      type="text" 
                      name="category" 
                      value={formData.category} 
                      onChange={handleChange} 
                      required 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="edit-rating" className="block text-sm font-medium text-gray-700 mb-1">
                      Rating
                    </label>
                    <input 
                      id="edit-rating"
                      type="number" 
                      name="rating" 
                      value={formData.rating} 
                      onChange={handleChange} 
                      required 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                      min="0" 
                      max="5" 
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-stock" className="block text-sm font-medium text-gray-700 mb-1">
                      Stock
                    </label>
                    <input 
                      id="edit-stock"
                      type="number" 
                      name="stock" 
                      value={formData.stock} 
                      onChange={handleChange} 
                      required 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                      min="0"
                      step="1"
                    />
                  </div>
                </div>
                <div className="mb-6">
                  <label htmlFor="edit-image" className="block text-sm font-medium text-gray-700 mb-1">
                    Update Image (optional)
                  </label>
                  <input 
                    id="edit-image"
                    type="file" 
                    name="image" 
                    onChange={handleChange} 
                    accept="image/*" 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                  />
                  {typeof formData.image === 'string' && (
                    <div className="mt-2 flex items-center">
                      <p className="text-sm text-gray-500 mr-2">Current image:</p>
                      <img src={formData.image} alt="Current product" className="w-16 h-16 object-cover rounded" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3 mt-6">
                  <button 
                    type="button" 
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors w-full sm:w-auto"
                    onClick={closeEditModal}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-md hover:from-blue-600 hover:to-indigo-700 transition-colors w-full sm:w-auto shadow-sm"
                  >
                    Update Product
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Product Modal - similar improvements */}
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-auto">
              <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Plus size={18} className="mr-2" /> Add New Product
                </h3>
                <button 
                  className="text-gray-500 hover:text-gray-700" 
                  onClick={closeAddModal}
                >
                  <X size={20} />
                </button>
              </div>
              {/* Form content - similar to edit form */}
              <form onSubmit={handleAddSubmit} className="p-4 sm:p-6">
                {errorMessage && (
                  <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md flex items-center">
                    <AlertCircle size={18} className="mr-2" />
                    {errorMessage}
                  </div>
                )}
                <div className="mb-4">
                  <label htmlFor="add-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input 
                    id="add-name"
                    type="text" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleChange} 
                    required 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                    placeholder="Product name"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="add-description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea 
                    id="add-description"
                    name="description" 
                    value={formData.description} 
                    onChange={handleChange} 
                    required 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 h-24"
                    placeholder="Describe your product"
                  ></textarea>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="add-price" className="block text-sm font-medium text-gray-700 mb-1">
                      Price
                    </label>
                    <input 
                      id="add-price"
                      type="number" 
                      name="price" 
                      value={formData.price} 
                      onChange={handleChange} 
                      required 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label htmlFor="add-category" className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <input 
                      id="add-category"
                      type="text" 
                      name="category" 
                      value={formData.category} 
                      onChange={handleChange} 
                      required 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                      placeholder="Category"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="add-rating" className="block text-sm font-medium text-gray-700 mb-1">
                      Rating
                    </label>
                    <input 
                      id="add-rating"
                      type="number" 
                      name="rating" 
                      value={formData.rating} 
                      onChange={handleChange} 
                      required 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                      min="0" 
                      max="5" 
                      step="0.1"
                      placeholder="0.0"
                    />
                  </div>
                  <div>
                    <label htmlFor="add-stock" className="block text-sm font-medium text-gray-700 mb-1">
                      Stock
                    </label>
                    <input 
                      id="add-stock"
                      type="number" 
                      name="stock" 
                      value={formData.stock} 
                      onChange={handleChange} 
                      required 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                      min="0"
                      step="1"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="mb-6">
                  <label htmlFor="add-image" className="block text-sm font-medium text-gray-700 mb-1">
                    Product Image
                  </label>
                  <input 
                    id="add-image"
                    type="file" 
                    name="image" 
                    onChange={handleChange} 
                    accept="image/*" 
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" 
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3 mt-6">
                  <button 
                    type="button" 
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors w-full sm:w-auto"
                    onClick={closeAddModal}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-md hover:from-blue-600 hover:to-indigo-700 transition-colors w-full sm:w-auto shadow-sm"
                  >
                    Add Product
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ManageProducts;

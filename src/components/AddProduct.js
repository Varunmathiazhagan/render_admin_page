import React, { useState } from "react";
import Navbar from "./Navbar";
import { Plus, Tag, DollarSign, Star, Package, FileText, Upload, Loader, Check } from "lucide-react";

const AddProduct = () => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    rating: "",
    stock: "",
    image: null,
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const form = new FormData();
      form.append("name", formData.name);
      form.append("description", formData.description);
      form.append("price", formData.price);
      form.append("category", formData.category);
      form.append("rating", formData.rating);
      form.append("stock", formData.stock);
      if (formData.image) {
        form.append("image", formData.image);
      }

      // Debug: log FormData keys
      for (let pair of form.entries()) {
        console.log(pair[0] + ": " + pair[1]);
      }

      // Update the endpoint to the correct one
      const response = await fetch("https://render-user-page.onrender.com/api/admin/products", {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Server error response:", errorData); // Log server error details
        throw new Error(errorData.error || "Failed to add product");
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      resetForm();
    } catch (error) {
      console.error("Error details:", error); // Log error details
      alert("Error adding product: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "image" && files?.length) {
      setFormData((prev) => ({ ...prev, image: files[0] }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(files[0]);
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      category: "",
      rating: "",
      stock: "",
      image: null,
    });
    setPreviewImage(null);
    const fileInput = document.getElementById("image-upload");
    if (fileInput) fileInput.value = "";
  };

  return (
    <>
      <Navbar />
      <div className="max-w-4xl mx-auto p-6">
        {showSuccess && (
          <div className="bg-green-50 text-green-600 p-4 mb-6 rounded-lg flex items-center shadow-md animate-fadeIn">
            <Check size={24} className="mr-2 text-green-500" />
            <span className="font-medium">Product Added Successfully!</span>
          </div>
        )}

        <h2 className="text-2xl font-bold mb-6 flex items-center text-gray-800">
          <Plus className="mr-2" size={28} />
          Add New Product
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">Basic Information</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center text-gray-700 font-medium">
                  <Tag size={16} className="mr-2 text-gray-500" />
                  Product Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter product name"
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center text-gray-700 font-medium">
                  <FileText size={16} className="mr-2 text-gray-500" />
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Enter product description"
                  rows="4"
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                ></textarea>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">Product Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="flex items-center text-gray-700 font-medium">
                  <DollarSign size={16} className="mr-2 text-gray-500" />
                  Price (₹)
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="Enter price"
                  step="0.01"
                  min="0"
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center text-gray-700 font-medium">
                  <Star size={16} className="mr-2 text-gray-500" />
                  Rating
                </label>
                <input
                  type="number"
                  name="rating"
                  value={formData.rating}
                  onChange={handleChange}
                  placeholder="Enter rating (0-5)"
                  min="0"
                  max="5"
                  step="0.1"
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center text-gray-700 font-medium">
                  <Package size={16} className="mr-2 text-gray-500" />
                  Stock
                </label>
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleChange}
                  placeholder="Enter stock quantity"
                  min="0"
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center text-gray-700 font-medium">
                  <FileText size={16} className="mr-2 text-gray-500" />
                  Category
                </label>
                <select 
                  name="category" 
                  value={formData.category} 
                  onChange={handleChange} 
                  required
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                >
                  <option value="">Select Category</option>
                  <option value="Piece">Piece</option>
                  <option value="Yarn">Yarn</option>
                  <option value="Needles">Needles</option>
                  <option value="Accessories">Accessories</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4 text-gray-700 border-b pb-2">Product Image</h3>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-full">
                <label 
                  htmlFor="image-upload" 
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition"
                >
                  <Upload size={24} className="mb-1 text-gray-500" />
                  <span className="text-sm text-gray-500">Click to upload or drag image here</span>
                  <input
                    type="file"
                    id="image-upload"
                    name="image"
                    onChange={handleChange}
                    accept="image/*"
                    required
                    className="hidden"
                  />
                </label>
              </div>
              {previewImage && (
                <div className="w-full">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Image Preview</h4>
                  <div className="border rounded-lg overflow-hidden h-32 bg-gray-100">
                    <img src={previewImage} alt="Product preview" className="w-full h-full object-contain" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button 
              type="button" 
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition focus:outline-none focus:ring-2 focus:ring-gray-400" 
              onClick={resetForm} 
              disabled={isSubmitting}
            >
              Clear Form
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-70" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader size={16} className="mr-2 animate-spin" />
                  Adding Product...
                </>
              ) : (
                <>
                  <Plus size={16} className="mr-2" />
                  Add Product
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default AddProduct;

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");

const app = express();
const PORT = 5000;
const MONGO_URI = "mongodb+srv://varun:454697@ksp.gqt0t.mongodb.net/M_v?retryWrites=true&w=majority&appName=KSP";

// Middleware
app.use(cors());
app.use(express.json());

// Counter schema for auto-incrementing IDs
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model("Counter", counterSchema);

// Product schema with validation
const productSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, required: true, trim: true },
  rating: { type: Number, required: true, min: 0, max: 5 },
  image: { type: String, required: true },
  stock: { type: Number, required: true, default: 0, min: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Pre-save middleware for auto-incrementing product ID
productSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      const counter = await Counter.findByIdAndUpdate(
        "productId",
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
      );
      this.id = counter.seq;
    }
    next();
  } catch (error) {
    next(error);
  }
});

const Product = mongoose.model("Products", productSchema);

// Task schema
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  due: { type: Date, required: true },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Task = mongoose.model("Task", taskSchema);

// Notification schema
const notificationSchema = new mongoose.Schema({
  type: { type: String, enum: ['order', 'message', 'user'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});
const Notification = mongoose.model("Notification", notificationSchema);

// GET notifications (latest 20, unread first)
app.get("/api/notifications", async (req, res) => {
  try {
    const notifications = await Notification.find({})
      .sort({ read: 1, createdAt: -1 })
      .limit(20);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch notifications", details: err.message });
  }
});

// Connect to MongoDB and update the counter to the max product id
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log("✅ MongoDB Connected");

    // Update the counter document to be in sync with the highest product id
    const lastProduct = await Product.findOne({}).sort({ id: -1 });
    const maxId = lastProduct ? lastProduct.id : 0;
    await Counter.findByIdAndUpdate(
      "productId",
      { seq: maxId },
      { upsert: true, new: true }
    );
    console.log(`✅ Counter set to ${maxId}`);

    // Drop the existing index (if any) and create a new unique index on id
    try {
      await mongoose.connection.collection("products").dropIndex("id_1");
      console.log("✅ Dropped existing index");
    } catch (error) {
      console.log("No existing index to drop");
    }
    await Product.collection.createIndex({ id: 1 }, { unique: true });
    console.log("✅ Created new unique index");
  })
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Multer configuration for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  }
});

// Helper function to format the product response
const formatProduct = (product) => ({
  id: product.id,
  _id: product._id,
  name: product.name,
  description: product.description,
  price: product.price,
  category: product.category,
  rating: product.rating,
  image: `data:image/png;base64,${product.image}`,
  stock: product.stock,
  createdAt: product.createdAt
});

// GET all products
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products.map(formatProduct));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products", details: err.message });
  }
});

// POST add a new product
app.post("/api/products", upload.single("image"), async (req, res) => {
  try {
    const { name, description, price, category, rating, stock } = req.body;

    // Validate required fields
    if (!name || !description || !price || !category || !rating || !stock) {
      return res.status(400).json({ error: "All fields are required" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Image is required" });
    }

    const newProduct = new Product({
      name,
      description,
      price: Number(price),
      category,
      rating: Number(rating),
      image: req.file.buffer.toString("base64"),
      stock: Number(stock),
    });

    await newProduct.save();
    res.status(201).json({ message: "✅ Product added successfully", product: formatProduct(newProduct) });
  } catch (err) {
    console.error("Error adding product:", err); // Log error details
    res.status(500).json({ error: "Failed to add product", details: err.message });
  }
});

// PUT update product by MongoDB _id
app.put("/api/products/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    const updateData = {
      name: req.body.name,
      description: req.body.description || existingProduct.description,
      price: Number(req.body.price),
      category: req.body.category,
      rating: Number(req.body.rating),
      stock: Number(req.body.stock)
    };

    if (req.file) {
      updateData.image = req.file.buffer.toString("base64");
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    });

    if (!updatedProduct) {
      throw new Error("Failed to update product");
    }

    res.json({
      success: true,
      message: "Product updated successfully",
      product: formatProduct(updatedProduct)
    });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ error: "Failed to update product", details: err.message });
  }
});

// DELETE a product
app.delete("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid product ID format" });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    await Product.findByIdAndDelete(id);
    res.json({
      success: true,
      message: "Product deleted successfully",
      deletedId: id
    });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Failed to delete product", details: err.message });
  }
});

// GET all tasks
app.get("/api/tasks", async (req, res) => {
  try {
    const tasks = await Task.find();
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tasks", details: err.message });
  }
});

// POST create a new task
app.post("/api/tasks", async (req, res) => {
  try {
    const { title, priority, due } = req.body;
    if (!title || !due) {
      return res.status(400).json({ error: "Title and due date are required" });
    }

    const newTask = new Task({
      title,
      priority: priority || 'medium',
      due: new Date(due)
    });

    await newTask.save();
    res.status(201).json({ message: "Task added successfully", task: newTask });
  } catch (err) {
    console.error("Error adding task:", err);
    res.status(500).json({ error: "Failed to add task", details: err.message });
  }
});

// PUT update a task
app.put("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, priority, due, completed } = req.body;
    
    const updatedTask = await Task.findByIdAndUpdate(
      id,
      { title, priority, due, completed },
      { new: true, runValidators: true }
    );
    
    if (!updatedTask) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    res.json({ message: "Task updated successfully", task: updatedTask });
  } catch (err) {
    console.error("Update task error:", err);
    res.status(500).json({ error: "Failed to update task", details: err.message });
  }
});

// DELETE a task
app.delete("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTask = await Task.findByIdAndDelete(id);
    
    if (!deletedTask) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    res.json({ message: "Task deleted successfully", deletedId: id });
  } catch (err) {
    console.error("Delete task error:", err);
    res.status(500).json({ error: "Failed to delete task", details: err.message });
  }
});

// Employee schema
const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true },
  phone: { type: String, trim: true },
  position: { type: String, required: true, trim: true },
  department: { type: String, trim: true },
  joiningDate: { type: Date, required: true },
  salary: { type: Number, min: 0 },
  address: { type: String, trim: true },
  status: { type: String, enum: ['active', 'inactive', 'on leave'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});
const Employee = mongoose.model("Employee", employeeSchema);

// GET all employees
app.get("/api/employees", async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch employees", details: err.message });
  }
});

// POST add employee
app.post("/api/employees", async (req, res) => {
  try {
    const { name, email, phone, position, department, joiningDate, salary, address, status } = req.body;
    if (!name || !email || !position || !joiningDate) {
      return res.status(400).json({ error: "Name, email, position, and joining date are required" });
    }
    const employee = new Employee({ name, email, phone, position, department, joiningDate, salary, address, status });
    await employee.save();
    res.status(201).json({ message: "Employee added", employee });
  } catch (err) {
    res.status(500).json({ error: "Failed to add employee", details: err.message });
  }
});

// PUT update employee
app.put("/api/employees/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;
    const employee = await Employee.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    res.json({ message: "Employee updated", employee });
  } catch (err) {
    res.status(500).json({ error: "Failed to update employee", details: err.message });
  }
});

// DELETE employee
app.delete("/api/employees/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findByIdAndDelete(id);
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    res.json({ message: "Employee deleted", deletedId: id });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete employee", details: err.message });
  }
});

// Expense schema
const expenseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Expense = mongoose.model("Expense", expenseSchema);

// GET all expenses
app.get("/api/expenses", async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch expenses", details: err.message });
  }
});

// POST add a new expense
app.post("/api/expenses", async (req, res) => {
  try {
    const { title, amount, date } = req.body;

    // Validate required fields
    if (!title || !amount || !date) {
      return res.status(400).json({ error: "Title, amount, and date are required" });
    }

    const expense = new Expense({ title, amount, date });
    await expense.save();
    res.status(201).json({ message: "Expense added successfully", expense });
  } catch (err) {
    res.status(500).json({ error: "Failed to add expense", details: err.message });
  }
});

// DELETE an expense
app.delete("/api/expenses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findByIdAndDelete(id);
    if (!expense) return res.status(404).json({ error: "Expense not found" });
    res.json({ message: "Expense deleted successfully", deletedId: id });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete expense", details: err.message });
  }
});

// Scheduled task to delete expenses older than one month
setInterval(async () => {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  try {
    const result = await Expense.deleteMany({ createdAt: { $lt: oneMonthAgo } });
    console.log(`✅ Deleted ${result.deletedCount} old expenses`);
  } catch (err) {
    console.error("❌ Failed to delete old expenses:", err.message);
  }
}, 24 * 60 * 60 * 1000); // Run daily

// Start the server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

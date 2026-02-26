const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const twilio = require("twilio");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const compression = require("compression");

const registerAdminRoutes = ({
  app,
  mongoose,
  authenticateToken,
  upload,
  formatProduct,
  models,
  transporter,
  twilioClient,
  twilioPhoneNumber,
}) => {
  const {
    Contact,
    User,
    Order,
    Notification,
    Product,
    Task,
    Employee,
    Expense,
  } = models;

  // --- In-memory response cache with TTL, invalidation & cleanup ---
  const responseCache = new Map();

  const invalidateCache = (prefix) => {
    for (const key of responseCache.keys()) {
      if (key.startsWith(prefix)) {
        responseCache.delete(key);
      }
    }
  };

  // Cleanup expired entries every 60 s
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of responseCache) {
      if (entry.expiresAt <= now) responseCache.delete(key);
    }
  }, 60000);

  const withResponseCache = (ttlMs = 30000) => {
    return (req, res, next) => {
      if (req.method !== "GET") { next(); return; }
      if (req.query && req.query.forceRefresh === "true") { next(); return; }

      const cacheKey = `${req.originalUrl}`;
      const cached = responseCache.get(cacheKey);
      const now = Date.now();

      if (cached && cached.expiresAt > now) {
        res.setHeader("X-Cache", "HIT");
        res.setHeader("Cache-Control", "private, max-age=30");
        res.status(cached.statusCode).json(cached.payload);
        return;
      }

      const originalJson = res.json.bind(res);
      res.json = (payload) => {
        responseCache.set(cacheKey, {
          statusCode: res.statusCode || 200,
          payload,
          expiresAt: Date.now() + ttlMs,
        });
        res.setHeader("X-Cache", "MISS");
        res.setHeader("Cache-Control", "private, max-age=30");
        return originalJson(payload);
      };

      next();
    };
  };

  const sendOrderStatusEmail = async (to, orderReference, status) => {
    if (!transporter) return;

    const mailOptions = {
      from: "mvarunmathi2004@gmail.com",
      to,
      subject: `Order Status Update - ${orderReference}`,
      text: `Hello,\n\nYour order with reference ${orderReference} has been updated to the status: ${status.toUpperCase()}.\n\nThank you for shopping with us!`,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log("Order status email sent:", info.response);
    } catch (error) {
      console.error("Error sending order status email:", error.message);
    }
  };

  const sendSms = async (to, message) => {
    try {
      if (!twilioClient || !twilioPhoneNumber) return;
      if (!to || typeof to !== "string") {
        console.error("Invalid phone number provided for SMS");
        return;
      }

      const formattedNumber = to.startsWith("+") ? to : `+91${to}`;
      await twilioClient.messages.create({
        body: message,
        from: twilioPhoneNumber,
        to: formattedNumber,
      });
      console.log(`SMS sent to ${formattedNumber}`);
    } catch (error) {
      console.error(`Failed to send SMS to ${to}:`, error.message);
      if (error.code) {
        console.error(`Twilio Error Code: ${error.code}`);
      }
    }
  };

  app.get("/api/contacts", authenticateToken, withResponseCache(30000), async (req, res) => {
    try {
      const contacts = await Contact.find({}).lean();
      res.status(200).json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contacts", details: error.message });
    }
  });

  app.get("/api/users", authenticateToken, withResponseCache(30000), async (req, res) => {
    try {
      const includeDemoUsers = req.query.includeDemo === "true";
      const users = await User.find({}, "email name createdAt lastLogin phone address profileImage preferences").lean();

      const isDemoUser = (user) => {
        const email = String(user?.email || "").toLowerCase();
        const name = String(user?.name || "").toLowerCase();

        return (
          email.endsWith("@tapacademy.com") ||
          email.includes("+test") ||
          email.startsWith("test") ||
          name.includes("test user") ||
          name.includes("demo user")
        );
      };

      const filteredUsers = includeDemoUsers ? users : users.filter((user) => !isDemoUser(user));
      res.status(200).json(filteredUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users", details: error.message });
    }
  });

  app.get("/api/orders", authenticateToken, withResponseCache(15000), async (req, res) => {
    try {
      const orders = await Order.find({}).sort({ createdAt: -1 }).lean();
      res.status(200).json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders. Please try again later." });
    }
  });

  app.get("/api/orders/admin/all", authenticateToken, withResponseCache(15000), async (req, res) => {
    try {
      const orders = await Order.find({}).sort({ createdAt: -1 }).lean();
      res.status(200).json({
        success: true,
        count: orders.length,
        orders,
      });
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch orders. Please try again later.",
        error: error.message,
      });
    }
  });

  app.put("/api/orders/admin/:id/status", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: "Status is required",
        });
      }

      const validStatuses = ["processing", "shipped", "delivered", "cancelled"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status value",
        });
      }

      const order = await Order.findById(id);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      order.orderStatus = status;

      if (status === "delivered" && order.paymentMethod === "cod" && order.paymentStatus === "pending") {
        order.paymentStatus = "completed";
      }

      if (status === "cancelled") {
        if (order.paymentStatus === "completed") {
          console.log(`Admin cancelled order ${id} with completed payment - refund may be needed`);
        } else if (order.paymentStatus === "pending") {
          order.paymentStatus = "failed";
        }
      }

      await order.save();

      // Invalidate orders cache after status change
      invalidateCache("/api/orders");

      const userPhone = order.shippingInfo.phone;
      if (userPhone) {
        const smsMessage = `Hello ${order.userName || "Customer"}, your order with reference ${order.orderReference} is now ${status.toUpperCase()}. Thank you for shopping with us!`;
        sendSms(userPhone, smsMessage);
      }

      if (order.userEmail) {
        sendOrderStatusEmail(order.userEmail, order.orderReference, status);
      }

      res.json({
        success: true,
        message: `Order status updated to ${status}`,
        order: {
          _id: order._id,
          orderStatus: order.orderStatus,
          paymentStatus: order.paymentStatus,
          updatedAt: order.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error updating order status (admin):", error);
      res.status(500).json({
        success: false,
        message: "Failed to update order status",
        error: error.message,
      });
    }
  });

  app.get("/api/notifications", authenticateToken, withResponseCache(15000), async (req, res) => {
    try {
      const notifications = await Notification.find({})
        .sort({ read: 1, createdAt: -1 })
        .limit(20)
        .lean();
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch notifications", details: err.message });
    }
  });

  app.get("/api/admin/products", authenticateToken, withResponseCache(30000), async (req, res) => {
    try {
      const products = await Product.find().lean();
      res.json(products.map(formatProduct));
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch products", details: err.message });
    }
  });

  app.post("/api/admin/products", authenticateToken, upload.single("image"), async (req, res) => {
    try {
      const { name, description, price, category, rating, stock } = req.body;

      if (!name || !description || !price || !category || !stock) {
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
        rating: Number(rating || 0),
        image: req.file.buffer.toString("base64"),
        stock: Number(stock),
      });

      await newProduct.save();
      invalidateCache("/api/admin/products");
      res.status(201).json({ message: "Product added successfully", product: formatProduct(newProduct) });
    } catch (err) {
      console.error("Error adding product:", err);
      res.status(500).json({ error: "Failed to add product", details: err.message });
    }
  });

  app.put("/api/admin/products/:id", authenticateToken, upload.single("image"), async (req, res) => {
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
        rating: Number(req.body.rating || existingProduct.rating),
        stock: Number(req.body.stock),
      };

      if (req.file) {
        updateData.image = req.file.buffer.toString("base64");
      }

      const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!updatedProduct) {
        throw new Error("Failed to update product");
      }

      invalidateCache("/api/admin/products");
      res.json({
        success: true,
        message: "Product updated successfully",
        product: formatProduct(updatedProduct),
      });
    } catch (err) {
      console.error("Update error:", err);
      res.status(500).json({ error: "Failed to update product", details: err.message });
    }
  });

  app.delete("/api/admin/products/:id", authenticateToken, async (req, res) => {
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
      invalidateCache("/api/admin/products");
      res.json({
        success: true,
        message: "Product deleted successfully",
        deletedId: id,
      });
    } catch (err) {
      console.error("Delete error:", err);
      res.status(500).json({ error: "Failed to delete product", details: err.message });
    }
  });

  app.get("/api/tasks", authenticateToken, withResponseCache(30000), async (req, res) => {
    try {
      const tasks = await Task.find().lean();
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch tasks", details: err.message });
    }
  });

  app.post("/api/tasks", authenticateToken, async (req, res) => {
    try {
      const { title, priority, due } = req.body;
      if (!title || !due) {
        return res.status(400).json({ error: "Title and due date are required" });
      }

      const newTask = new Task({
        title,
        priority: priority || "medium",
        due: new Date(due),
      });

      await newTask.save();
      invalidateCache("/api/tasks");
      res.status(201).json({ message: "Task added successfully", task: newTask });
    } catch (err) {
      console.error("Error adding task:", err);
      res.status(500).json({ error: "Failed to add task", details: err.message });
    }
  });

  app.put("/api/tasks/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid task ID format" });
      }
      const { title, priority, due, completed } = req.body;

      const updatedTask = await Task.findByIdAndUpdate(
        id,
        { title, priority, due, completed },
        { new: true, runValidators: true }
      );

      if (!updatedTask) {
        return res.status(404).json({ error: "Task not found" });
      }

      invalidateCache("/api/tasks");
      res.json({ message: "Task updated successfully", task: updatedTask });
    } catch (err) {
      console.error("Update task error:", err);
      res.status(500).json({ error: "Failed to update task", details: err.message });
    }
  });

  app.delete("/api/tasks/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: "Invalid task ID format" });
      }
      const deletedTask = await Task.findByIdAndDelete(id);

      if (!deletedTask) {
        return res.status(404).json({ error: "Task not found" });
      }

      invalidateCache("/api/tasks");
      res.json({ message: "Task deleted successfully", deletedId: id });
    } catch (err) {
      console.error("Delete task error:", err);
      res.status(500).json({ error: "Failed to delete task", details: err.message });
    }
  });

  app.get("/api/employees", authenticateToken, withResponseCache(30000), async (req, res) => {
    try {
      const employees = await Employee.find().sort({ createdAt: -1 }).lean();
      res.json(employees);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch employees", details: err.message });
    }
  });

  app.post("/api/employees", authenticateToken, async (req, res) => {
    try {
      const { name, email, phone, position, department, joiningDate, salary, address, status } = req.body;
      if (!name || !email || !position || !joiningDate) {
        return res.status(400).json({ error: "Name, email, position, and joining date are required" });
      }
      const employee = new Employee({ name, email, phone, position, department, joiningDate, salary, address, status });
      await employee.save();
      invalidateCache("/api/employees");
      res.status(201).json({ message: "Employee added", employee });
    } catch (err) {
      res.status(500).json({ error: "Failed to add employee", details: err.message });
    }
  });

  app.put("/api/employees/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const update = req.body;
      const employee = await Employee.findByIdAndUpdate(id, update, { new: true, runValidators: true });
      if (!employee) return res.status(404).json({ error: "Employee not found" });
      invalidateCache("/api/employees");
      res.json({ message: "Employee updated", employee });
    } catch (err) {
      res.status(500).json({ error: "Failed to update employee", details: err.message });
    }
  });

  app.delete("/api/employees/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const employee = await Employee.findByIdAndDelete(id);
      if (!employee) return res.status(404).json({ error: "Employee not found" });
      invalidateCache("/api/employees");
      res.json({ message: "Employee deleted", deletedId: id });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete employee", details: err.message });
    }
  });

  app.get("/api/expenses", authenticateToken, withResponseCache(30000), async (req, res) => {
    try {
      const expenses = await Expense.find().sort({ date: -1 }).lean();
      res.json(expenses);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch expenses", details: err.message });
    }
  });

  app.post("/api/expenses", authenticateToken, async (req, res) => {
    try {
      const { title, amount, date } = req.body;

      if (!title || !amount || !date) {
        return res.status(400).json({ error: "Title, amount, and date are required" });
      }

      const expense = new Expense({ title, amount, date });
      await expense.save();
      invalidateCache("/api/expenses");
      res.status(201).json({ message: "Expense added successfully", expense });
    } catch (err) {
      res.status(500).json({ error: "Failed to add expense", details: err.message });
    }
  });

  app.delete("/api/expenses/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const expense = await Expense.findByIdAndDelete(id);
      if (!expense) return res.status(404).json({ error: "Expense not found" });
      invalidateCache("/api/expenses");
      res.json({ message: "Expense deleted successfully", deletedId: id });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete expense", details: err.message });
    }
  });

  setInterval(async () => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    try {
      const result = await Expense.deleteMany({ createdAt: { $lt: oneMonthAgo } });
      console.log(`Deleted ${result.deletedCount} old expenses`);
    } catch (err) {
      console.error("Failed to delete old expenses:", err.message);
    }
  }, 24 * 60 * 60 * 1000);

  app.get("/api/orders/:id/timeline", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const order = await Order.findById(id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const timeline = [
        { status: "Order Placed", timestamp: order.createdAt },
        { status: "Processing", timestamp: order.updatedAt },
        ...(order.orderStatus === "shipped" ? [{ status: "Shipped", timestamp: new Date() }] : []),
        ...(order.orderStatus === "delivered" ? [{ status: "Delivered", timestamp: new Date() }] : []),
      ];

      res.json({ success: true, timeline });
    } catch (error) {
      console.error("Error fetching order timeline:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });

  app.post("/api/orders/:id/notes", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const { note } = req.body;

      if (!note || typeof note !== "string" || note.trim().length === 0) {
        return res.status(400).json({ message: "Note is required and must be a non-empty string" });
      }

      const order = await Order.findById(id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      await Order.findByIdAndUpdate(id, { $push: { notes: note.trim() } });
      const updatedOrder = await Order.findById(id).select("notes").lean();

      res.json({ success: true, message: "Note added successfully", notes: updatedOrder.notes });
    } catch (error) {
      console.error("Error adding note:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });

  app.get("/api/orders/export/csv", authenticateToken, async (req, res) => {
    try {
      const orders = await Order.find().lean();
      const csvHeaders = "Order ID,User Email,Total Price,Order Status\n";
      const sanitizeCsvField = (field) => {
        const str = String(field);
        if (/^[=+\-@\t\r]/.test(str)) return `'${str}`;
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvRows = orders
        .map(
          (order) =>
            `${sanitizeCsvField(order._id)},${sanitizeCsvField(order.userEmail)},${sanitizeCsvField(order.totalPrice)},${sanitizeCsvField(order.orderStatus)}`
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
      res.send(csvHeaders + csvRows);
    } catch (error) {
      console.error("Error exporting orders to CSV:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });

  app.get("/api/orders/export/pdf", authenticateToken, async (req, res) => {
    try {
      const orders = await Order.find().lean();
      const doc = new PDFDocument();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=orders.pdf");

      doc.pipe(res);
      doc.fontSize(16).text("Orders Report", { align: "center" });
      doc.moveDown();

      orders.forEach((order) => {
        doc
          .fontSize(12)
          .text(
            `Order ID: ${order._id}, User Email: ${order.userEmail}, Total Price: ${order.totalPrice}, Status: ${order.orderStatus}`
          );
        doc.moveDown();
      });

      doc.end();
    } catch (error) {
      console.error("Error exporting orders to PDF:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });

  app.get("/api/orders/:id/print", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const order = await Order.findById(id);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const doc = new PDFDocument();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=order_${id}.pdf`);

      doc.pipe(res);
      doc.fontSize(16).text(`Order Details - ${id}`, { align: "center" });
      doc.moveDown();
      doc.fontSize(12).text(`User Email: ${order.userEmail}`);
      doc.text(`Total Price: ${order.totalPrice}`);
      doc.text(`Order Status: ${order.orderStatus}`);
      doc.text("Order Items:");
      order.orderItems.forEach((item) => {
        doc.text(`- ${item.name} (x${item.quantity}): $${item.price}`);
      });
      doc.end();
    } catch (error) {
      console.error("Error printing order:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });
};

const app = express();

app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src *"
  );
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

const rateLimitStore = new Map();
const createRateLimiter = (windowMs, maxRequests) => {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, []);
    }

    const requests = rateLimitStore.get(key).filter((t) => t > windowStart);
    rateLimitStore.set(key, requests);

    if (requests.length >= maxRequests) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }

    requests.push(now);
    next();
  };
};

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitStore) {
    const filtered = timestamps.filter((t) => t > now - 900000);
    if (filtered.length === 0) rateLimitStore.delete(key);
    else rateLimitStore.set(key, filtered);
  }
}, 60000);

const apiLimiter = createRateLimiter(15 * 60 * 1000, 100);

const PORT = 5009;
const JWT_SECRET = "4953546c308be3088b28807c767bd35e99818434d130a588e5e6d90b6d1d326e";
const MONGO_URI = "mongodb+srv://varun:454697@ksp.gqt0t.mongodb.net/M_v?retryWrites=true&w=majority";

const accountSid = "ACc0cb37efc0705fbe73b2ecbea1b94f6d";
const authToken = "6a118d8d4e55cb742032ab7f33f58101";
const twilioPhoneNumber = "+17756181167";
const client = twilio(accountSid, authToken);

app.use(express.json({ limit: "10mb" }));
app.use(compression());

const allowedOrigins = new Set([
  "https://ksp-gamma.vercel.app",
  "https://kspyarnsadmin.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://ksp.varunm.tech",
  "https://kspadmin.varunm.tech",
]);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use("/api", apiLimiter);

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.model("Counter", counterSchema);

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  googleId: { type: String },
  name: { type: String },
  createdAt: { type: Date, default: Date.now },
  phone: { type: String },
  address: { type: String },
  profileImage: { type: String },
  lastLogin: { type: Date, default: Date.now },
  preferences: {
    notifications: { type: Boolean, default: true },
    newsletter: { type: Boolean, default: false },
    darkMode: { type: Boolean, default: false },
  },
  orderHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
  wishlist: [
    {
      productId: { type: String, required: true },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      image: { type: String },
      description: { type: String },
      category: { type: String },
      addedAt: { type: Date, default: Date.now },
    },
  ],
  lastUpdated: { type: Date },
});
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ googleId: 1 }, { sparse: true });
const User = mongoose.model("User", userSchema);

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, default: "Pending" },
    createdAt: { type: Date, default: Date.now, expires: "7d" },
  },
  { timestamps: true }
);
const Contact = mongoose.model("Contact", contactSchema);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    userEmail: { type: String, required: true },
    userName: { type: String, required: false, default: "Guest User" },
    orderItems: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
        image: { type: String },
        productId: { type: String, required: true },
      },
    ],
    shippingInfo: {
      fullName: { type: String, required: true },
      addressLine1: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      phone: { type: String, required: true },
    },
    deliveryMethod: { type: String, required: true, enum: ["standard", "express"] },
    paymentMethod: { type: String, required: true, enum: ["razorpay", "cod"] },
    paymentStatus: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
    paymentResult: {
      id: { type: String },
      status: { type: String },
      update_time: { type: String },
      email_address: { type: String },
    },
    subtotal: { type: Number, required: true },
    deliveryPrice: { type: Number, required: true, default: 0 },
    totalPrice: { type: Number, required: true },
    orderStatus: {
      type: String,
      required: true,
      enum: ["processing", "shipped", "delivered", "cancelled"],
      default: "processing",
    },
    orderReference: { type: String, required: true, unique: true },
    notes: [{ type: String }],
  },
  { timestamps: true }
);
orderSchema.index({ userEmail: 1 });
orderSchema.index({ user: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ orderReference: 1 }, { unique: true });
const Order = mongoose.model("Order", orderSchema);

const productSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, default: 0, min: 0 },
  description: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  image: { type: String, required: true },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

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

const Product = mongoose.model("Product", productSchema);

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  priority: { type: String, enum: ["high", "medium", "low"], default: "medium" },
  due: { type: Date, required: true },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
const Task = mongoose.model("Task", taskSchema);

const notificationSchema = new mongoose.Schema({
  type: { type: String, enum: ["order", "message", "user"], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
});
const Notification = mongoose.model("Notification", notificationSchema);

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true },
  phone: { type: String, trim: true },
  position: { type: String, required: true, trim: true },
  department: { type: String, trim: true },
  joiningDate: { type: Date, required: true },
  salary: { type: Number, min: 0 },
  address: { type: String, trim: true },
  status: { type: String, enum: ["active", "inactive", "on leave"], default: "active" },
  createdAt: { type: Date, default: Date.now },
});
const Employee = mongoose.model("Employee", employeeSchema);

const expenseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});
const Expense = mongoose.model("Expense", expenseSchema);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired. Please log in again." });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(403).json({ message: "Invalid token. Please log in again." });
    }
    console.error("Token verification error:", error);
    res.status(500).json({ message: "Internal server error during token verification." });
  }
};

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  },
});

const formatProduct = (product) => ({
  id: product.id,
  _id: product._id,
  name: product.name,
  description: product.description,
  price: product.price,
  category: product.category,
  rating: product.rating || 0,
  image: product.image.startsWith("data:") ? product.image : `data:image/png;base64,${product.image}`,
  stock: product.stock,
  createdAt: product.createdAt,
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "mvarunmathi2004@gmail.com",
    pass: "ahiw jlsz dzxaohso",
  },
});

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected (admin server)");

    const lastProduct = await Product.findOne({}).sort({ id: -1 });
    const maxId = lastProduct ? lastProduct.id : 0;
    await Counter.findByIdAndUpdate("productId", { seq: maxId }, { upsert: true, new: true });

    try {
      await mongoose.connection.collection("products").dropIndex("id_1");
    } catch (error) {
      console.log("No existing product id_1 index to drop on admin server");
    }

    await Product.collection.createIndex({ id: 1 }, { unique: true });
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// Admin login endpoint (no auth required)
app.post("/api/admin/login", (req, res) => {
  try {
    const { username, password } = req.body;
    const ADMIN_USERNAME = "Varun";
    const ADMIN_PASSWORD = "4546";

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: "admin", email: "admin@ksp.org", role: "admin" },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      success: true,
      token,
      user: { username: ADMIN_USERNAME, role: "admin" },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

registerAdminRoutes({
  app,
  mongoose,
  authenticateToken,
  upload,
  formatProduct,
  models: {
    Contact,
    User,
    Order,
    Notification,
    Product,
    Task,
    Employee,
    Expense,
  },
  transporter,
  twilioClient: client,
  twilioPhoneNumber,
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "File too large. Maximum size is 5MB." });
  }
  if (err.message === "Only image files are allowed!") {
    return res.status(400).json({ message: err.message });
  }
  if (err.message && err.message.includes("CORS")) {
    return res.status(403).json({ message: "Not allowed by CORS" });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body" });
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

const gracefulShutdown = async () => {
  console.log("Shutting down admin server gracefully...");
  try {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  } catch (err) {
    console.error("Error during shutdown:", err);
  }
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

app.listen(PORT, () => console.log(`Admin server is running on port: ${PORT}`));

/** @format */

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware Setup
app.use(cors());
// Base64 বা বড় ফাইল হ্যান্ডেল করার জন্য লিমিট বাড়িয়ে দেওয়া হলো
app.use(express.json({ limit: "10mb" }));

// MongoDB URI Configuration
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // ডাটাবেজের সাথে কানেক্ট করা
    await client.connect();
    console.log("📌 Successfully connected to MongoDB for NaiSell!");

    // ডাইনামিকালি .env থেকে ডাটাবেজের নাম নেওয়া হলো
    const db = client.db(process.env.DB_NAME || "NaiSellDB");
    const productsCollection = db.collection("products");
    const ordersCollection = db.collection("orders");
    const usersCollection = db.collection("users");
    const wishlistCollection = db.collection("wishlist");

    // =========================================================================
    // 👤 ৪. PROFILE OPERATIONS (Get & Update Profile with Stats)
    // =========================================================================

    // [READ] - বায়ার প্রোফাইল ডাটা এবং তার সাথে স্ট্যাটস লোড করা
    app.get("/api/users/profile", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email)
          return res
            .status(400)
            .send({ success: false, message: "Email is required" });

        // ইউজার ইনফো খোঁজা
        const user = await usersCollection.findOne({ email: email });
        if (!user)
          return res
            .status(404)
            .send({ success: false, message: "User not found" });

        // ডায়নামিক স্ট্যাটাস কাউন্ট করা
        const totalOrders = await ordersCollection.countDocuments({
          buyerEmail: email,
        });
        const wishlistCount = await wishlistCollection.countDocuments({
          buyerEmail: email,
        });

        // মোট খরচ (Total Spent) হিসাব করা (Paid অর্ডারগুলো থেকে)
        const paidOrders = await ordersCollection
          .find({ buyerEmail: email, paymentStatus: "Paid" })
          .toArray();
        const totalSpent = paidOrders.reduce(
          (sum, order) => sum + (parseFloat(order.totalAmount) || 0),
          0,
        );

        // রেসপন্স অবজেক্ট সাজানো (ফ্রন্টএন্ডের স্টেট স্ট্রাকচার অনুযায়ী)
        res.send({
          success: true,
          user: {
            name: user.name || "",
            email: user.email,
            image: user.image || "",
            stats: {
              totalOrders,
              wishlistCount,
              totalSpent: totalSpent.toLocaleString("bn-BD"), // সুন্দর ফরম্যাটের জন্য
            },
          },
        });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [UPDATE] - বায়ার প্রোফাইল ডাটা আপডেট করা
    app.put("/api/users/profile", async (req, res) => {
      try {
        const { email, name, image } = req.body;
        if (!email)
          return res
            .status(400)
            .send({ success: false, message: "Email is required" });

        const result = await usersCollection.updateOne(
          { email: email },
          { $set: { name: name, image: image } },
          { upsert: true }, // ইউজার না থাকলে তৈরি করবে, থাকলে আপডেট করবে
        );

        res.send({
          success: true,
          message: "🎉 Profile updated successfully on NaiSell!",
          result,
        });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // =========================================================================
    // 🧑‍💻 ১. BUYER DASHBOARD OPERATIONS (Stats, Orders, Wishlist, Payments)
    // =========================================================================

    // [READ] - বায়ার ওভারভিউ স্ট্যাটস
    app.get("/api/buyer/stats", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email)
          return res.status(400).send({ message: "Email is required" });

        const totalOrders = await ordersCollection.countDocuments({
          buyerEmail: email,
        });
        const wishlistCount = await wishlistCollection.countDocuments({
          buyerEmail: email,
        });

        res.send({ totalOrders, wishlistCount });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [READ] - বায়ারের নিজের সব অর্ডারের লিস্ট
    app.get("/api/buyer/orders", async (req, res) => {
      try {
        const { email } = req.query;
        const orders = await ordersCollection
          .find({ buyerEmail: email })
          .sort({ orderDate: -1 })
          .toArray();
        res.send(orders);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [UPDATE] - বায়ার কর্তৃক অর্ডার বাতিল করা
    app.patch("/api/orders/:id/cancel", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };

        const order = await ordersCollection.findOne(filter);
        if (!order) return res.status(404).send({ message: "Order not found" });

        if (order.status === "Shipped" || order.status === "Delivered") {
          return res
            .status(400)
            .send({ message: "Cannot cancel order after shipment." });
        }

        const result = await ordersCollection.updateOne(filter, {
          $set: { status: "Cancelled" },
        });
        res.send({
          success: true,
          message: "Order cancelled successfully.",
          result,
        });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [READ] - বায়ারের উইশলিস্টের সব প্রোডাক্ট
    app.get("/api/wishlist", async (req, res) => {
      try {
        const { email } = req.query;
        const wishlist = await wishlistCollection
          .find({ buyerEmail: email })
          .toArray();
        res.send(wishlist);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [CREATE] - উইশলিস্টে প্রোডাক্ট সেভ করা
    app.post("/api/wishlist", async (req, res) => {
      try {
        const wishItem = req.body;
        const result = await wishlistCollection.insertOne(wishItem);
        res.status(201).send({ success: true, result });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [DELETE] - উইশলিস্ট থেকে প্রোডাক্ট রিমুভ করা
    app.delete("/api/wishlist/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await wishlistCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [READ] - বায়ারের পেমেন্ট হিস্ট্রি
    app.get("/api/buyer/payments", async (req, res) => {
      try {
        const { email } = req.query;
        const payments = await ordersCollection
          .find({ buyerEmail: email, paymentStatus: "Paid" })
          .project({
            transactionId: 1,
            totalAmount: 1,
            orderDate: 1,
            status: 1,
            products: 1,
          })
          .toArray();
        res.send(payments);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // =========================================================================
    // 👨‍💼 ২. SELLER DASHBOARD OPERATIONS (Product CRUD, Orders & Analytics)
    // =========================================================================
    app.get("/api/products", async (req, res) => {
      try {
        const { email, search, category, condition } = req.query;
        let query = {};

        // ⚡ ফিক্সড লজিক: ফ্রন্টএন্ড থেকে আসা email কুয়েরিকে ডাটাবেজের sellerEmail প্রপার্টির সাথে ম্যাপ করা হলো
        if (email) {
          query.sellerEmail = email;
        }

        if (search) query.title = { $regex: search, $options: "i" };
        if (category) query.category = category;
        if (condition) query.condition = condition;

        const products = await productsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();

        res.send(products);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // Seller Stats API: Total Products, Sales, Revenue, Pending Orders
    app.get("/api/seller/stats/:email", async (req, res) => {
      try {
        const email = req.params.email;

        // ১. শুধুমাত্র ঐ সেলারের আপলোড করা টোটাল প্রোডাক্ট সংখ্যা
        const totalProducts = await productsCollection.countDocuments({
          sellerEmail: email,
        });

        // ২. 🛠️ ফিক্সড লজিক: "products.sellerEmail" ম্যাচ করিয়ে অর্ডার ডাটা খোঁজা
        const sellerOrders = await ordersCollection
          .find({
            "products.sellerEmail": email,
          })
          .toArray();

        // ৩. ক্যালকুলেশন ইনিশিয়ালাইজেশন
        let totalSales = 0;
        let totalRevenue = 0;
        let pendingOrders = 0;

        // ৪. লুপ চালিয়ে প্রতিটি অর্ডারের ডাটা হিসাব করা
        sellerOrders.forEach((order) => {
          if (order.status === "Delivered") {
            totalSales += 1; // ডেলিভারি কমপ্লিট হলে সেলস কাউন্ট হবে
            totalRevenue += Number(order.totalAmount || 0); // 🛠️ ফিক্সড ফিল্ড: order.price পরিবর্তন করে order.totalAmount করা হলো
          } else if (order.status === "Pending") {
            pendingOrders += 1; // পেন্ডিং অর্ডার কাউন্ট হবে
          }
        });

        // ৫. ফ্রন্টএন্ডে সাকসেস রেসপন্স পাঠানো
        res.send({
          success: true,
          stats: {
            totalProducts,
            totalSales,
            totalRevenue,
            pendingOrders,
          },
        });
      } catch (error) {
        console.error("Error calculating seller stats:", error);
        res.status(500).send({
          success: false,
          message: "Internal Server Error",
        });
      }
    });

    // [READ] - সেলার ড্যাশবোর্ড কার্ড স্ট্যাটস
    app.get("/api/seller/stats", async (req, res) => {
      try {
        const { email } = req.query;
        const totalProducts = await productsCollection.countDocuments({
          sellerEmail: email,
        });
        const pendingOrders = await ordersCollection.countDocuments({
          "products.sellerEmail": email,
          status: "Pending",
        });

        const completedOrders = await ordersCollection
          .find({ "products.sellerEmail": email, status: "Delivered" })
          .toArray();
        const totalSales = completedOrders.length;
        const totalRevenue = completedOrders.reduce(
          (sum, order) => sum + (order.totalAmount || 0),
          0,
        );

        res.send({ totalProducts, totalSales, totalRevenue, pendingOrders });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [CREATE] - নতুন প্রোডাক্ট লিস্টিং
    app.post("/api/products", async (req, res) => {
      try {
        const product = req.body;
        product.price = parseFloat(product.price);
        product.stock = parseInt(product.stock);
        product.createdAt = new Date();
        product.status = "Pending";

        const result = await productsCollection.insertOne(product);
        res.status(201).send({ success: true, result });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [READ] - সেলারের নিজের প্রোডাক্ট লিস্ট (Search & Filter সহ)
    app.get("/api/products", async (req, res) => {
      try {
        const { email, search, category, condition } = req.query;
        let query = {};

        if (email) query.sellerEmail = email;
        if (search) query.title = { $regex: search, $options: "i" };
        if (category) query.category = category;
        if (condition) query.condition = condition;

        const products = await productsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();
        res.send(products);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [UPDATE] - প্রোডাক্ট এডিট
    app.put("/api/products/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;
        delete updatedData._id;

        if (updatedData.price)
          updatedData.price = parseFloat(updatedData.price);
        if (updatedData.stock) updatedData.stock = parseInt(updatedData.stock);

        const result = await productsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData },
        );
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [DELETE] - প্রোডাক্ট ডিলিট
    app.delete("/api/products/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await productsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [READ] - সেলারের ইনকামিং কাস্টমার অর্ডার
    app.get("/api/seller/orders", async (req, res) => {
      try {
        const { email } = req.query;
        const orders = await ordersCollection
          .find({ "products.sellerEmail": email })
          .sort({ orderDate: -1 })
          .toArray();
        res.send(orders);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [UPDATE STATUS] - অর্ডার স্ট্যাটাস আপডেট
    app.patch("/api/orders/:id/status", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;
        const result = await ordersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: status } },
        );
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [READ] - সেলার চার্ট এনালিটিক্স
    app.get("/api/seller/analytics", async (req, res) => {
      try {
        const analyticsData = {
          monthlySales: [
            { month: "Jan", sales: 12000 },
            { month: "Feb", sales: 18500 },
            { month: "Mar", sales: 24000 },
            { month: "Apr", sales: 19000 },
            { month: "May", sales: 31000 },
            { month: "Jun", sales: 38500 },
          ],
          topProducts: [
            { name: "iPhone 13 Pro Max", unitsSold: 5, revenue: 325000 },
            { name: "Sony WH-1000XM4", unitsSold: 8, revenue: 176000 },
            { name: "Mechanical Keyboard", unitsSold: 12, revenue: 54000 },
          ],
        };
        res.send(analyticsData);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // =========================================================================
    // 👑 ৩. ADMIN DASHBOARD OPERATIONS (User & Product Control, Global Stats)
    // =========================================================================

    // [READ] - অ্যাডমিন ড্যাশবোর্ড ওভারভিউ
    app.get("/api/admin/analytics", async (req, res) => {
      try {
        const totalUsers = await usersCollection.countDocuments();
        const totalProducts = await productsCollection.countDocuments();
        const totalOrders = await ordersCollection.countDocuments();

        const analyticsData = {
          cards: { totalUsers, totalProducts, totalOrders },
          userGrowth: [
            { month: "Jan", users: 150 },
            { month: "Feb", users: 320 },
            { month: "Mar", users: 580 },
            { month: "Apr", users: 890 },
            { month: "May", users: 1200 },
            { month: "Jun", users: 1750 },
          ],
          categoryPerformance: [
            { category: "Electronics", productsListed: 420, orders: 280 },
            { category: "Fashion", productsListed: 310, orders: 190 },
            { category: "Gadgets", productsListed: 290, orders: 210 },
          ],
          monthlyOrders: [
            { month: "Jan", orders: 85 },
            { month: "Feb", orders: 140 },
            { month: "Mar", orders: 210 },
            { month: "Jun", orders: 450 },
          ],
        };
        res.send(analyticsData);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [READ] - সমস্ত ইউজার লিস্ট এবং সার্চ ম্যানেজমেন্ট
    app.get("/api/admin/users", async (req, res) => {
      try {
        const { search } = req.query;
        let query = {};
        if (search) {
          query = {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
            ],
          };
        }
        const users = await usersCollection.find(query).toArray();
        res.send(users);
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [UPDATE] - ইউজার ব্লক/আনব্লক স্ট্যাটাস
    app.patch("/api/admin/users/:id/status", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: status } },
        );
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [DELETE] - ইউজার অ্যাকাউন্ট ডিলিট
    app.delete("/api/admin/users/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await usersCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [UPDATE] - প্রোডাক্ট অনুমোদন বা রিজেকশন (Moderation)
    app.patch("/api/admin/products/:id/moderation", async (req, res) => {
      try {
        const id = req.params.id;
        const { action } = req.body;
        const result = await productsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: action } },
        );
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });

    // [READ] - প্রোফাইল ম্যানেজমেন্ট
    app.patch("/api/users/profile", async (req, res) => {
      try {
        const { email, name, image } = req.body;
        const result = await usersCollection.updateOne(
          { email: email },
          { $set: { name: name, image: image } },
        );
        res.send({
          success: true,
          message: "Profile updated successfully",
          result,
        });
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
      }
    });
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
  }
}

run().catch(console.dir);

// Base API Checking Route
app.get("/", (req, res) => {
  res.send("🚀 NaiSell Server is running perfectly fine!");
});

// Server Listener
app.listen(port, () => {
  console.log(`active and listening on port: ${port}`);
});

const { ObjectId } = require("mongodb");
const { verifyToken, requireRole } = require("../middleware/auth");

function adminRoutes(app, { usersCollection, productsCollection, ordersCollection, paymentsCollection }) {
  app.get("/api/admin/analytics", verifyToken, requireRole("admin"), async (req, res) => {
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

  app.get("/api/admin/users", verifyToken, requireRole("admin"), async (req, res) => {
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

  app.patch("/api/admin/users/:id/status", verifyToken, requireRole("admin"), async (req, res) => {
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

  app.delete("/api/admin/users/:id", verifyToken, requireRole("admin"), async (req, res) => {
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

  app.patch("/api/admin/products/:id/moderation", verifyToken, requireRole("admin"), async (req, res) => {
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

  // Admin payment monitoring
  app.get("/api/admin/payments", verifyToken, requireRole("admin"), async (req, res) => {
    try {
      const { search, status } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      let query = {};
      if (search) {
        query.$or = [
          { transactionId: { $regex: search, $options: "i" } },
          { buyerEmail: { $regex: search, $options: "i" } },
        ];
      }
      if (status) {
        query.paymentStatus = status;
      }

      const payments = await paymentsCollection
        .find(query)
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await paymentsCollection.countDocuments(query);

      const revenuePipeline = await paymentsCollection.aggregate([
        { $match: { paymentStatus: "Paid" } },
        { $group: { _id: null, totalRevenue: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]).toArray();

      const summary = {
        totalRevenue: revenuePipeline[0]?.totalRevenue || 0,
        totalTransactions: revenuePipeline[0]?.count || 0,
        successRate: total > 0 ? `${Math.round(((revenuePipeline[0]?.count || 0) / total) * 100)}%` : "0%",
      };

      res.send({
        success: true,
        payments,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        summary,
      });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });
  // Admin stats overview (alias for analytics cards)
  app.get("/api/admin/stats", verifyToken, requireRole("admin"), async (req, res) => {
    try {
      const totalUsers = await usersCollection.countDocuments();
      const totalProducts = await productsCollection.countDocuments();
      const totalOrders = await ordersCollection.countDocuments();
      const totalRevenue = await paymentsCollection.aggregate([
        { $match: { paymentStatus: "Paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).toArray();
      res.send({
        success: true,
        stats: {
          totalUsers,
          totalProducts,
          totalOrders,
          totalRevenue: totalRevenue[0]?.total || 0,
        },
      });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  // Admin product listing/moderation
  app.get("/api/admin/products", verifyToken, requireRole("admin"), async (req, res) => {
    try {
      const { search, status } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      let query = {};
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: "i" } },
          { sellerEmail: { $regex: search, $options: "i" } },
        ];
      }
      if (status) query.status = status;

      const products = await productsCollection.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
      const total = await productsCollection.countDocuments(query);
      res.send({ success: true, result: products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  // Fix: client calls /moderate, server had /moderation — align to /moderate
  app.patch("/api/admin/products/:id/moderate", verifyToken, requireRole("admin"), async (req, res) => {
    try {
      const id = req.params.id;
      const { status } = req.body;
      const result = await productsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );
      res.send({ success: true, result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  // Admin orders listing
  app.get("/api/admin/orders", verifyToken, requireRole("admin"), async (req, res) => {
    try {
      const { search, status } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      let query = {};
      if (search) {
        query.$or = [
          { buyerEmail: { $regex: search, $options: "i" } },
          { sellerEmail: { $regex: search, $options: "i" } },
        ];
      }
      if (status) query.status = status;

      const orders = await ordersCollection.find(query).sort({ orderDate: -1 }).skip(skip).limit(limit).toArray();
      const total = await ordersCollection.countDocuments(query);
      res.send({ success: true, result: orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  // Admin update order status
  app.patch("/api/admin/orders/:id/status", verifyToken, requireRole("admin"), async (req, res) => {
    try {
      const { status } = req.body;
      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status } }
      );
      res.send({ success: true, result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });
}

module.exports = adminRoutes;

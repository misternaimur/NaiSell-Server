const { ObjectId } = require("mongodb");
const { verifyToken, requireRole } = require("../middleware/auth");

function sellerRoutes(app, collections) {
  app.get("/api/seller/stats", verifyToken, requireRole("seller"), async (req, res) => {
    try {
      const { email } = req.query;
      if (!collections.productsCollection)
        return res.status(503).send({ success: false, message: "Database not connected yet." });

      const totalProducts = await collections.productsCollection.countDocuments({
        sellerEmail: email,
      });
      const pendingOrders = await collections.ordersCollection.countDocuments({
        "products.sellerEmail": email,
        status: "Pending",
      });

      const completedOrders = await collections.ordersCollection
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

  app.get("/api/seller/stats/:email", verifyToken, requireRole("seller"), async (req, res) => {
    try {
      const email = req.params.email;
      if (!collections.productsCollection)
        return res.status(503).send({ success: false, message: "Database not connected yet." });

      const totalProducts = await collections.productsCollection.countDocuments({
        sellerEmail: email,
      });

      const sellerOrders = await collections.ordersCollection
        .find({ "products.sellerEmail": email })
        .toArray();

      let totalSales = 0;
      let totalRevenue = 0;
      let pendingOrders = 0;

      sellerOrders.forEach((order) => {
        if (order.status === "Delivered") {
          totalSales += 1;
          totalRevenue += Number(order.totalAmount || 0);
        } else if (order.status === "Pending") {
          pendingOrders += 1;
        }
      });

      res.send({
        success: true,
        stats: { totalProducts, totalSales, totalRevenue, pendingOrders },
      });
    } catch (error) {
      console.error("Error calculating seller stats:", error);
      res.status(500).send({ success: false, message: "Internal Server Error" });
    }
  });

  app.get("/api/seller/orders", verifyToken, requireRole("seller"), async (req, res) => {
    try {
      const { email } = req.query;
      if (!collections.ordersCollection)
        return res.status(503).send({ success: false, message: "Database not connected yet." });

      const orders = await collections.ordersCollection
        .find({ "products.sellerEmail": email })
        .sort({ orderDate: -1 })
        .toArray();
      res.send(orders);
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  app.patch("/api/orders/:id/status", verifyToken, requireRole("seller"), async (req, res) => {
    try {
      const id = req.params.id;
      const { status } = req.body;
      if (!collections.ordersCollection)
        return res.status(503).send({ success: false, message: "Database not connected yet." });

      const result = await collections.ordersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: status } },
      );
      res.send({ success: true, result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  app.get("/api/seller/analytics", verifyToken, requireRole("seller"), async (req, res) => {
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
}

module.exports = sellerRoutes;

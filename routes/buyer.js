const { ObjectId } = require("mongodb");
const { verifyToken, requireRole } = require("../middleware/auth");

function buyerRoutes(app, { ordersCollection, wishlistCollection, paymentsCollection }) {
  app.get("/api/buyer/stats", verifyToken, requireRole("buyer"), async (req, res) => {
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

  app.get("/api/buyer/orders", verifyToken, requireRole("buyer"), async (req, res) => {
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

  app.get("/api/buyer/payments", verifyToken, requireRole("buyer"), async (req, res) => {
    try {
      const { email } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const payments = await paymentsCollection
        .find({ buyerEmail: email })
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await paymentsCollection.countDocuments({ buyerEmail: email });

      res.send({
        success: true,
        payments,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  app.patch("/api/orders/:id/cancel", verifyToken, requireRole("buyer"), async (req, res) => {
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
}

module.exports = buyerRoutes;

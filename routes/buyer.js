const { ObjectId } = require("mongodb");
const { verifyToken, requireRole } = require("../middleware/auth");

function buyerRoutes(app, collections) {
  app.get("/api/buyer/stats", verifyToken, requireRole("buyer"), async (req, res) => {
    try {
      const { email } = req.query;
      if (!email)
        return res.status(400).send({ message: "Email is required" });
      if (!collections.ordersCollection)
        return res.status(503).send({ success: false, message: "Database not connected yet." });

      const totalOrders = await collections.ordersCollection.countDocuments({
        buyerEmail: email,
      });
      const wishlistCount = await collections.wishlistCollection.countDocuments({
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
      if (!collections.ordersCollection)
        return res.status(503).send({ success: false, message: "Database not connected yet." });

      const orders = await collections.ordersCollection.aggregate([
        { $match: { buyerEmail: email } },
        {
          $addFields: {
            productObjId: {
              $cond: {
                if: { $eq: [{ $strLenCP: "$productId" }, 24] },
                then: { $toObjectId: "$productId" },
                else: null
              }
            }
          }
        },
        {
          $lookup: {
            from: "products",
            localField: "productObjId",
            foreignField: "_id",
            as: "product"
          }
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        { $sort: { orderDate: -1 } }
      ]).toArray();
      res.send(orders);
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  app.get("/api/buyer/payments", verifyToken, requireRole("buyer"), async (req, res) => {
    try {
      const { email } = req.query;
      if (!collections.paymentsCollection)
        return res.status(503).send({ success: false, message: "Database not connected yet." });

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const payments = await collections.paymentsCollection
        .find({ buyerEmail: email })
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await collections.paymentsCollection.countDocuments({ buyerEmail: email });

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
      if (!collections.ordersCollection)
        return res.status(503).send({ success: false, message: "Database not connected yet." });

      const filter = { _id: new ObjectId(id) };

      const order = await collections.ordersCollection.findOne(filter);
      if (!order) return res.status(404).send({ message: "Order not found" });

      if (order.status === "Shipped" || order.status === "Delivered") {
        return res
          .status(400)
          .send({ message: "Cannot cancel order after shipment." });
      }

      const result = await collections.ordersCollection.updateOne(filter, {
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

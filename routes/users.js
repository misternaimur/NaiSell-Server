const { verifyToken, requireRole } = require("../middleware/auth");

function usersRoutes(app, collections) {
  // Protected - get profile
  app.get("/api/users/profile", verifyToken, async (req, res) => {
    try {
      const email = req.query.email;
      if (!email)
        return res.status(400).send({ success: false, message: "Email is required" });
      if (!collections.usersCollection)
        return res.status(503).send({ success: false, message: "Database not connected yet." });

      const user = await collections.usersCollection.findOne({ email: email });
      if (!user)
        return res
          .status(404)
          .send({ success: false, message: "User not found" });

      const totalOrders = await collections.ordersCollection.countDocuments({
        buyerEmail: email,
      });
      const wishlistCount = await collections.wishlistCollection.countDocuments({
        buyerEmail: email,
      });

      const paidOrders = await collections.ordersCollection
        .find({ buyerEmail: email, paymentStatus: "Paid" })
        .toArray();
      const totalSpent = paidOrders.reduce(
        (sum, order) => sum + (parseFloat(order.totalAmount) || 0),
        0,
      );

      res.send({
        success: true,
        user: {
          name: user.name || "",
          email: user.email,
          image: user.image || "",
          stats: {
            totalOrders,
            wishlistCount,
            totalSpent: totalSpent.toLocaleString("bn-BD"),
          },
        },
      });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  // Protected - update profile
  app.put("/api/users/profile", verifyToken, async (req, res) => {
    try {
      const { email, name, image } = req.body;
      if (!email)
        return res.status(400).send({ success: false, message: "Email is required" });
      if (!collections.usersCollection)
        return res.status(503).send({ success: false, message: "Database not connected yet." });

      const result = await collections.usersCollection.updateOne(
        { email: email },
        { $set: { name: name, image: image } },
        { upsert: true },
      );

      res.send({
        success: true,
        message: "Profile updated successfully on NaiSell!",
        result,
      });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });
}

module.exports = usersRoutes;

const { verifyToken, requireRole } = require("../middleware/auth");

function usersRoutes(app, { usersCollection, ordersCollection, wishlistCollection }) {
  // Protected - get profile
  app.get("/api/users/profile", verifyToken, async (req, res) => {
    try {
      const { email } = req.query;
      if (!email)
        return res
          .status(400)
          .send({ success: false, message: "Email is required" });

      const user = await usersCollection.findOne({ email: email });
      if (!user)
        return res
          .status(404)
          .send({ success: false, message: "User not found" });

      const totalOrders = await ordersCollection.countDocuments({
        buyerEmail: email,
      });
      const wishlistCount = await wishlistCollection.countDocuments({
        buyerEmail: email,
      });

      const paidOrders = await ordersCollection
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
        return res
          .status(400)
          .send({ success: false, message: "Email is required" });

      const result = await usersCollection.updateOne(
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

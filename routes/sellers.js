const { ObjectId } = require("mongodb");

function sellersRoutes(app, collections) {
  // Public - top sellers
  app.get("/api/sellers/top", async (req, res) => {
    if (!collections.productsCollection)
      return res.status(503).send({ success: false, message: "Database not connected yet." });
    try {
      const topSellers = await collections.productsCollection.aggregate([
        { $match: { status: "Available" } },
        {
          $group: {
            _id: "$sellerEmail",
            totalProducts: { $sum: 1 },
            avgPrice: { $avg: "$price" },
          },
        },
        { $sort: { totalProducts: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "user",
            localField: "_id",
            foreignField: "email",
            as: "user",
          },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            email: "$_id",
            name: { $ifNull: ["$user.name", "Seller"] },
            image: { $ifNull: ["$user.image", ""] },
            totalProducts: 1,
            avgPrice: { $round: ["$avgPrice", 0] },
          },
        },
      ]).toArray();

      res.send(topSellers);
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });
}

module.exports = sellersRoutes;

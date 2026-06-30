function categoriesRoutes(app, collections) {
  app.get("/api/categories", async (req, res) => {
    if (!collections.productsCollection) {
      return res.status(503).send({ success: false, message: "Database not connected yet." });
    }
    try {
      const categories = await collections.productsCollection.aggregate([
        { $group: { _id: "$category" } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, category: "$_id" } },
      ]).toArray();
      res.send(categories.map((c) => c.category).filter(Boolean));
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });
}

module.exports = categoriesRoutes;


function categoriesRoutes(app, { productsCollection }) {
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await productsCollection.aggregate([
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

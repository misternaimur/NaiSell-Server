const { ObjectId } = require("mongodb");
const { verifyToken, requireRole } = require("../middleware/auth");

function reviewsRoutes(app, collections) {
  // Public - get reviews for a product
  app.get("/api/reviews/:productId", async (req, res) => {
    if (!collections.reviewsCollection)
      return res.status(503).send({ success: false, message: "Database not connected yet." });
    try {
      const { productId } = req.params;
      const reviews = await collections.reviewsCollection
        .find({ productId })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(reviews);
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  // Protected - create review
  app.post("/api/reviews", verifyToken, requireRole("buyer"), async (req, res) => {
    if (!collections.reviewsCollection)
      return res.status(503).send({ success: false, message: "Database not connected yet." });
    try {
      const review = req.body;
      review.createdAt = new Date();
      const result = await collections.reviewsCollection.insertOne(review);
      res.status(201).send({ success: true, result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  // Protected - delete own review
  app.delete("/api/reviews/:id", verifyToken, requireRole("buyer"), async (req, res) => {
    if (!collections.reviewsCollection)
      return res.status(503).send({ success: false, message: "Database not connected yet." });
    try {
      const id = req.params.id;
      const result = await collections.reviewsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send({ success: true, result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });
}

module.exports = reviewsRoutes;

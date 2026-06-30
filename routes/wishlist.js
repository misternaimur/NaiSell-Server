const { ObjectId } = require("mongodb");
const { verifyToken, requireRole } = require("../middleware/auth");

function wishlistRoutes(app, collections) {
  // Protected - get wishlist
  app.get("/api/wishlist", verifyToken, requireRole("buyer"), async (req, res) => {
    if (!collections.wishlistCollection)
      return res.status(503).send({ success: false, message: "Database not connected yet." });
    try {
      const { email } = req.query;
      const wishlist = await collections.wishlistCollection
        .find({ buyerEmail: email })
        .toArray();
      res.send(wishlist);
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  // Protected - add to wishlist
  app.post("/api/wishlist", verifyToken, requireRole("buyer"), async (req, res) => {
    if (!collections.wishlistCollection)
      return res.status(503).send({ success: false, message: "Database not connected yet." });
    try {
      const wishItem = req.body;
      const result = await collections.wishlistCollection.insertOne(wishItem);
      res.status(201).send({ success: true, result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  // Protected - remove from wishlist
  app.delete("/api/wishlist/:id", verifyToken, requireRole("buyer"), async (req, res) => {
    if (!collections.wishlistCollection)
      return res.status(503).send({ success: false, message: "Database not connected yet." });
    try {
      const id = req.params.id;
      const result = await collections.wishlistCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send({ success: true, result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });
}

module.exports = wishlistRoutes;

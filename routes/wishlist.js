const { ObjectId } = require("mongodb");
const { verifyToken, requireRole } = require("../middleware/auth");

function wishlistRoutes(app, { wishlistCollection }) {
  // Protected - get wishlist
  app.get("/api/wishlist", verifyToken, requireRole("buyer"), async (req, res) => {
    try {
      const { email } = req.query;
      const wishlist = await wishlistCollection
        .find({ buyerEmail: email })
        .toArray();
      res.send(wishlist);
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  // Protected - add to wishlist
  app.post("/api/wishlist", verifyToken, requireRole("buyer"), async (req, res) => {
    try {
      const wishItem = req.body;
      const result = await wishlistCollection.insertOne(wishItem);
      res.status(201).send({ success: true, result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  // Protected - remove from wishlist
  app.delete("/api/wishlist/:id", verifyToken, requireRole("buyer"), async (req, res) => {
    try {
      const id = req.params.id;
      const result = await wishlistCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send({ success: true, result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });
}

module.exports = wishlistRoutes;

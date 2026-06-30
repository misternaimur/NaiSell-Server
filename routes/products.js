const { ObjectId } = require("mongodb");
const { verifyToken, requireRole } = require("../middleware/auth");

function productsRoutes(app, collections) {
  // Public - list products
  app.get("/api/products", async (req, res) => {
    if (!collections.productsCollection) {
      return res.status(503).send({ success: false, message: "Database not connected yet. Please retry in a moment." });
    }
    try {
      const { email, search, category, condition } = req.query;
      let query = {};

      if (email) {
        query.sellerEmail = email;
      }

      if (search) query.title = { $regex: search, $options: "i" };
      if (category) query.category = category;
      if (condition) query.condition = condition;

      const products = await collections.productsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      res.send(products);
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  // Public - get single product by ID
  app.get("/api/products/:id", async (req, res) => {
    if (!collections.productsCollection) {
      return res.status(503).send({ success: false, message: "Database not connected yet." });
    }
    try {
      const { id } = req.params;
      let product;
      try {
        product = await collections.productsCollection.findOne({ _id: new ObjectId(id) });
      } catch {
        return res.status(404).send({ success: false, message: "Product not found" });
      }
      if (!product) {
        return res.status(404).send({ success: false, message: "Product not found" });
      }
      res.send(product);
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  // Protected - create product (seller only)
  app.post("/api/products", verifyToken, requireRole("seller"), async (req, res) => {
    if (!collections.productsCollection) {
      return res.status(503).send({ success: false, message: "Database not connected yet." });
    }
    try {
      const product = req.body;
      product.price = parseFloat(product.price);
      product.stock = parseInt(product.stock);
      product.createdAt = new Date();
      product.status = "Pending";

      const result = await collections.productsCollection.insertOne(product);
      res.status(201).send({ success: true, result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  // Protected - update product (seller only)
  app.put("/api/products/:id", verifyToken, requireRole("seller"), async (req, res) => {
    if (!collections.productsCollection) {
      return res.status(503).send({ success: false, message: "Database not connected yet." });
    }
    try {
      const id = req.params.id;
      const updatedData = req.body;
      delete updatedData._id;

      if (updatedData.price)
        updatedData.price = parseFloat(updatedData.price);
      if (updatedData.stock) updatedData.stock = parseInt(updatedData.stock);

      const result = await collections.productsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData },
      );
      res.send({ success: true, result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });

  // Protected - delete product (seller only)
  app.delete("/api/products/:id", verifyToken, requireRole("seller"), async (req, res) => {
    if (!collections.productsCollection) {
      return res.status(503).send({ success: false, message: "Database not connected yet." });
    }
    try {
      const id = req.params.id;
      const result = await collections.productsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send({ success: true, result });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });
}

module.exports = productsRoutes;


const serverless = require("serverless-http");
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  credentials: true,
}));

// Stripe webhook needs raw body
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10mb" }));

let cachedClient = null;
let cachedDb = null;

async function getDb() {
  if (cachedDb) return cachedDb;

  const client = await MongoClient.connect(process.env.MONGODB_URI, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  });

  cachedClient = client;
  cachedDb = client.db(process.env.DB_NAME || "nai_sell_db");
  return cachedDb;
}

async function getCollections() {
  const db = await getDb();
  return {
    productsCollection: db.collection("products"),
    ordersCollection: db.collection("orders"),
    usersCollection: db.collection("users"),
    wishlistCollection: db.collection("wishlist"),
    reviewsCollection: db.collection("reviews"),
  };
}

// Lazy-load routes on first request
let routesLoaded = false;

app.use(async (req, res, next) => {
  if (!routesLoaded) {
    try {
      const collections = await getCollections();
      require("./routes/users")(app, collections);
      require("./routes/buyer")(app, collections);
      require("./routes/seller")(app, collections);
      require("./routes/products")(app, collections);
      require("./routes/wishlist")(app, collections);
      require("./routes/admin")(app, collections);
      require("./routes/categories")(app, collections);
      require("./routes/reviews")(app, collections);
      require("./routes/sellers")(app, collections);
      require("./routes/payments")(app, collections);
      routesLoaded = true;
    } catch (error) {
      console.error("Failed to load routes:", error);
      return res.status(500).json({ success: false, message: "Server initialization failed" });
    }
  }
  next();
});

app.get("/", (req, res) => {
  res.json({ message: "NaiSell Server is running" });
});

module.exports = app;
module.exports.handler = serverless(app);

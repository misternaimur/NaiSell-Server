/** @format */

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Allow both localhost (dev) and production client
const allowedOrigins = [
  "http://localhost:3000",
   process.env.CLIENT_URL,
];

app.use(
  cors({
    origin: ["http://localhost:3000", process.env.CLIENT_URL],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("ERROR: MONGODB_URI is not set in NaiSell-Server/.env");
  process.exit(1);
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Placeholder collections — will be replaced after successful DB connect
let collections = {
  db: null,
  productsCollection: null,
  ordersCollection: null,
  usersCollection: null,
  wishlistCollection: null,
  reviewsCollection: null,
  paymentsCollection: null,
};

// Mount all routes immediately so the server always responds
require("./routes/users")(app, collections);
require("./routes/auth")(app, collections);
require("./routes/buyer")(app, collections);
require("./routes/seller")(app, collections);
require("./routes/products")(app, collections);
require("./routes/wishlist")(app, collections);
require("./routes/admin")(app, collections);
require("./routes/categories")(app, collections);
require("./routes/reviews")(app, collections);
require("./routes/sellers")(app, collections);
require("./routes/payments")(app, collections);

async function connectDB() {
  try {
    await client.connect();
    console.log("✅ Successfully connected to MongoDB!");

    const db = client.db(process.env.DB_NAME || "nai_sell_db");

    // Populate the shared collections object in-place so existing route references update
    Object.assign(collections, {
      db,
      productsCollection: db.collection("products"),
      ordersCollection: db.collection("orders"),
      usersCollection: db.collection("user"),
      wishlistCollection: db.collection("wishlist"),
      reviewsCollection: db.collection("reviews"),
      paymentsCollection: db.collection("payments"),
    });

    console.log("✅ All collections are ready.");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    console.error("   Check your MONGODB_URI and Atlas IP whitelist settings.");
  }
}

connectDB();

app.get("/", (req, res) => {
  res.send("NaiSell Server is running perfectly fine!");
});

app.listen(port, () => {
  console.log(`🚀 Server active and listening on port: ${port}`);
});

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("Successfully connected to MongoDB for NaiSell!");

    const db = client.db(process.env.DB_NAME || "NaiSellDB");
    const collections = {
      productsCollection: db.collection("products"),
      ordersCollection: db.collection("orders"),
      usersCollection: db.collection("users"),
      wishlistCollection: db.collection("wishlist"),
      reviewsCollection: db.collection("reviews"),
    };

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

    console.log("All routes mounted successfully!");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("NaiSell Server is running perfectly fine!");
});

app.listen(port, () => {
  console.log(`active and listening on port: ${port}`);
});

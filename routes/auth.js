const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");

const JWT_SECRET = process.env.JWT_SECRET;

function authRoutes(app, collections) {
  // Exchange a Better-Auth session token for a JWT
  app.post("/api/auth/token", async (req, res) => {
    if (!collections.db) {
      return res.status(503).send({ success: false, message: "Database not connected yet." });
    }
    try {
      const { sessionToken } = req.body;
      if (!sessionToken) {
        return res.status(400).send({ success: false, message: "Session token is required" });
      }

      // Look up the session in Better-Auth's session collection
      const sessionsCollection = collections.db.collection("session");

      const session = await sessionsCollection.findOne({
        $or: [
          { id: sessionToken },
          { sessionToken: sessionToken },
          { _id: ObjectId.isValid(sessionToken) ? new ObjectId(sessionToken) : null },
        ].filter(Boolean),
        expiresAt: { $gt: new Date() },
      });

      if (!session) {
        return res.status(401).send({ success: false, message: "Invalid or expired session" });
      }

      // Look up the user
      const userId = session.userId || session.user_id;
      let user = null;

      // Try to find by _id first
      if (ObjectId.isValid(userId)) {
        user = await collections.usersCollection.findOne({ _id: new ObjectId(userId) });
      }

      // Fallback: find by email
      if (!user) {
        user = await collections.usersCollection.findOne({ email: userId });
      }

      // Last resort: find by any id field
      if (!user) {
        user = await collections.usersCollection.findOne({ id: userId });
      }

      if (!user) {
        return res.status(404).send({ success: false, message: "User not found" });
      }

      // Generate JWT
      const tokenPayload = {
        id: user._id.toString(),
        email: user.email,
        role: user.role || "buyer",
        name: user.name || "",
      };

      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });

      res.send({
        success: true,
        token,
        user: tokenPayload,
      });
    } catch (error) {
      console.error("Token exchange error:", error);
      res.status(500).send({ success: false, message: error.message });
    }
  });

  // Validate JWT and return user info
  app.get("/api/auth/me", async (req, res) => {
    if (!collections.usersCollection) {
      return res.status(503).send({ success: false, message: "Database not connected yet." });
    }
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send({ success: false, message: "No token provided" });
      }

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      const user = await collections.usersCollection.findOne({ email: decoded.email });
      if (!user) {
        return res.status(404).send({ success: false, message: "User not found" });
      }

      res.send({
        success: true,
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name || "",
          image: user.image || "",
          role: user.role || "buyer",
        },
      });
    } catch (error) {
      return res.status(401).send({ success: false, message: "Invalid or expired token" });
    }
  });
}

module.exports = authRoutes;
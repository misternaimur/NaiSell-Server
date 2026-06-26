const { ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { verifyToken, requireRole } = require("../middleware/auth");

function paymentsRoutes(app, { ordersCollection, paymentsCollection, productsCollection }) {
  // Create Stripe checkout session
  app.post("/api/payments/create-checkout-session", verifyToken, requireRole("buyer"), async (req, res) => {
    try {
      const { productId, quantity, buyerEmail } = req.body;

      const product = await productsCollection.findOne({ _id: new ObjectId(productId) });
      if (!product) {
        return res.status(404).send({ success: false, message: "Product not found" });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: product.title,
                images: product.images?.length ? product.images : [],
              },
              unit_amount: Math.round(product.price * 100),
            },
            quantity: quantity || 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/checkout`,
        metadata: {
          productId,
          buyerEmail,
          sellerEmail: product.sellerEmail,
        },
      });

      res.send({ success: true, sessionId: session.id, url: session.url });
    } catch (error) {
      console.error("Stripe checkout error:", error);
      res.status(500).send({ success: false, message: error.message });
    }
  });

  // Stripe webhook
  app.post("/api/payments/webhook", (req, res) => {
    // In Express 5, raw body parsing is handled by the middleware setup in api/index.js
    // The raw body is already parsed by express.raw() middleware applied before routes
    handleWebhook(req, res);
  });

  async function handleWebhook(req, res) {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const order = {
        buyerEmail: session.metadata.buyerEmail,
        sellerEmail: session.metadata.sellerEmail,
        productId: session.metadata.productId,
        totalAmount: session.amount_total / 100,
        paymentStatus: "Paid",
        status: "Pending",
        transactionId: session.payment_intent,
        orderDate: new Date(),
      };

      const orderResult = await ordersCollection.insertOne(order);

      const payment = {
        transactionId: session.payment_intent,
        stripeSessionId: session.id,
        orderId: orderResult.insertedId,
        buyerEmail: session.metadata.buyerEmail,
        amount: session.amount_total / 100,
        paymentStatus: "Paid",
        paymentMethod: "card",
        paymentDate: new Date(),
        createdAt: new Date(),
      };

      await paymentsCollection.insertOne(payment);

      await productsCollection.updateOne(
        { _id: new ObjectId(session.metadata.productId) },
        { $set: { status: "Sold" } }
      );
    }

    res.json({ received: true });
  }

  // Get checkout session status
  app.get("/api/payments/session/:sessionId", verifyToken, requireRole("buyer"), async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      res.send({ success: true, session });
    } catch (error) {
      res.status(500).send({ success: false, message: error.message });
    }
  });
}

module.exports = paymentsRoutes;
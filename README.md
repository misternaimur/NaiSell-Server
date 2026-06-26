# NaiSell Server

Backend API server for NaiSell marketplace platform.

## Tech Stack
- Node.js + Express.js
- MongoDB (MongoDB Atlas)
- Better-Auth (client-side)
- JWT (API protection)
- Stripe (payments)

## Setup
```bash
npm install
cp .env.example .env  # Configure your env vars
npm run dev
```

## Environment Variables
```
PORT=5000
MONGODB_URI=your_mongodb_uri
DB_NAME=nai_sell_db
JWT_SECRET=your_jwt_secret
STRIPE_SECRET_KEY=your_stripe_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret
CLIENT_URL=http://localhost:3000
```

## API Endpoints
- `GET /api/products` - List products
- `GET /api/products/:id` - Product details
- `GET /api/categories` - List categories
- `POST /api/payments/create-checkout-session` - Stripe checkout
- `POST /api/payments/webhook` - Stripe webhook

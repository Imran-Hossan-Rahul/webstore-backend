# Payment System Setup Guide

## Overview

This payment system uses **Stripe** to process payments from customers worldwide and **Payoneer** to pay out creators. The system handles:

- ✅ Free and paid template downloads
- ✅ Global payment processing via Stripe
- ✅ Automatic commission calculation (30% platform, 70% creator)
- ✅ Creator payout management via Payoneer
- ✅ Transaction tracking and history
- ✅ Webhook-based payment confirmation

## Architecture

### Payment Flow

1. **Customer** → Stripe Checkout → **Payment Processed**
2. **Stripe Webhook** → **Transaction Created** → **Template Unlocked**
3. **Creator Earnings** → **Accumulated** → **Payout Request** → **Payoneer Transfer**

### Commission Structure

- Platform Commission: 30% (configurable via `PLATFORM_COMMISSION` env var)
- Creator Share: 70%
- Minimum Payout: $50 (configurable per creator)

## Setup Instructions

### 1. Stripe Account Setup

1. **Create Stripe Account**

   - Go to https://stripe.com
   - Sign up for an account
   - Complete business verification

2. **Get API Keys**

   - Go to Dashboard → Developers → API keys
   - Copy your **Secret Key** (starts with `sk_`)
   - Copy your **Publishable Key** (starts with `pk_`)

3. **Set Up Webhook**
   - Go to Dashboard → Developers → Webhooks
   - Click "Add endpoint"
   - Endpoint URL: `https://yourdomain.com/api/v1/payment/webhook`
   - Select events:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.refunded`
   - Copy the **Webhook Signing Secret** (starts with `whsec_`)

### 2. Environment Variables

Add these to your `.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... (or sk_live_... for production)
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_... (for frontend)

# Platform Settings
PLATFORM_COMMISSION=30  # Percentage (30% = platform, 70% = creator)
FRONTEND_URL=https://yourdomain.com

# Payment Settings
MINIMUM_PAYOUT_THRESHOLD=50  # Minimum $50 for payout
```

### 3. Install Dependencies

```bash
cd backend
npm install stripe
```

### 4. Database Models

The following models are created:

- **Transaction**: Tracks all purchases
- **Payout**: Manages creator payouts
- **User**: Extended with payout settings (Payoneer email, etc.)

### 5. API Endpoints

#### Payment Endpoints

```
POST /api/v1/payment/create-session
Body: { templateId: "..." }
Response: { checkoutUrl: "...", sessionId: "..." }

GET /api/v1/payment/verify?sessionId=...
Response: { transaction: {...} }

GET /api/v1/payment/history
Response: { transactions: [...] }

POST /api/v1/payment/webhook (Stripe webhook)
```

#### Payout Endpoints (Creator)

```
GET /api/v1/payout/summary
Response: { summary: {...}, pendingTransactions: [...], recentPayouts: [...] }

POST /api/v1/payout/request
Response: { payout: {...} }

PUT /api/v1/payout/settings
Body: { payoneerEmail: "...", payoutMethod: "payoneer" }
```

#### Payout Endpoints (Admin)

```
GET /api/v1/payout/all?status=pending&page=1&limit=20
POST /api/v1/payout/:payoutId/process
Body: { externalReference: "...", notes: "..." }
POST /api/v1/payout/:payoutId/cancel
Body: { reason: "..." }
```

## Creator Setup

### For Template Creators:

1. **Set Payoneer Email**

   ```javascript
   PUT /api/v1/payout/settings
   {
     "payoneerEmail": "creator@example.com",
     "payoutMethod": "payoneer"
   }
   ```

2. **Check Earnings**

   ```javascript
   GET / api / v1 / payout / summary;
   ```

3. **Request Payout** (when >= $50)
   ```javascript
   POST / api / v1 / payout / request;
   ```

## Admin Payout Process

### Manual Payout Processing:

1. **View Pending Payouts**

   ```
   GET /api/v1/payout/all?status=pending
   ```

2. **Process Payout via Payoneer**

   - Log into Payoneer
   - Send payment to creator's Payoneer email
   - Note the Payoneer transaction ID

3. **Mark as Completed**
   ```
   POST /api/v1/payout/:payoutId/process
   {
     "externalReference": "PAYONEER_TXN_12345",
     "notes": "Paid via Payoneer on 2024-01-15"
   }
   ```

## Frontend Integration

### 1. Create Payment Session

```javascript
const response = await fetch("/api/v1/payment/create-session", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ templateId }),
});

const { checkoutUrl } = await response.json();
window.location.href = checkoutUrl; // Redirect to Stripe Checkout
```

### 2. Handle Payment Success

```javascript
// After Stripe redirects back
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get("session_id");

// Verify payment
const verifyResponse = await fetch(
  `/api/v1/payment/verify?sessionId=${sessionId}`,
  {
    headers: { Authorization: `Bearer ${token}` },
  }
);

const { transaction } = await verifyResponse.json();
if (transaction.status === "completed") {
  // Show success message and enable download
}
```

### 3. Download Template

```javascript
const downloadResponse = await fetch(
  `/api/v1/template/${templateId}/download`,
  {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }
);

const data = await downloadResponse.json();
if (data.success) {
  // Download file from data.url
} else if (data.paid && data.requiresPurchase) {
  // Show payment modal
}
```

## Testing

### Stripe Test Mode

1. Use test API keys (starts with `sk_test_` and `pk_test_`)
2. Use test card numbers:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - 3D Secure: `4000 0027 6000 3184`

### Webhook Testing

Use Stripe CLI for local testing:

```bash
stripe listen --forward-to localhost:5000/api/v1/payment/webhook
stripe trigger checkout.session.completed
```

## Security Considerations

1. **Webhook Verification**: Always verify webhook signatures
2. **Idempotency**: Check for duplicate transactions
3. **Rate Limiting**: Apply rate limits to payment endpoints
4. **HTTPS**: Use HTTPS in production
5. **Environment Variables**: Never commit API keys to git

## Troubleshooting

### Payment Not Confirming

- Check webhook endpoint is accessible
- Verify webhook secret in `.env`
- Check Stripe dashboard for webhook delivery logs

### Payout Issues

- Verify Payoneer email is correct
- Check minimum threshold is met
- Ensure payout is enabled for creator

### Transaction Not Found

- Check webhook is firing correctly
- Verify transaction was created in database
- Check Stripe payment intent status

## Production Checklist

- [ ] Switch to Stripe Live keys
- [ ] Update webhook URL to production domain
- [ ] Set up monitoring/alerts for failed payments
- [ ] Configure automatic payout processing (optional)
- [ ] Set up email notifications for payouts
- [ ] Test refund flow
- [ ] Review security settings
- [ ] Set up backup webhook endpoint

## Support

For Stripe support: https://support.stripe.com
For Payoneer support: https://www.payoneer.com/support/

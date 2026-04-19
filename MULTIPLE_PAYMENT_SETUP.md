# Multiple Payment Methods Setup Guide

## Overview
এই system এখন multiple payment methods support করে:
- ✅ **Stripe** (যদি available হয়)
- ✅ **Payoneer** (Payment links)
- ✅ **Manual Payment** (bKash, Nagad, Rocket, Bank Transfer)
- ✅ **SSLCommerz/Aamarpay** (Bangladesh gateways - optional)

## Payment Methods

### 1. Stripe (যদি available হয়)
- Global payment processing
- Automatic verification
- Card payments

### 2. Payoneer
- User Payoneer দিয়ে payment করতে পারবে
- Manual verification required
- Instructions দেওয়া হবে

### 3. Manual Payment Methods
- **bKash** - Mobile banking
- **Nagad** - Mobile banking  
- **Rocket** - DBBL mobile banking
- **Bank Transfer** - Direct bank transfer
- সব manual payment-এর জন্য screenshot upload করতে হবে
- Admin manually verify করবে

## Setup Instructions

### 1. Environment Variables

`.env` file-এ যোগ করুন:

```env
# Stripe (Optional - যদি available হয়)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Payoneer
PAYONEER_RECEIVE_EMAIL=your-payoneer@email.com

# Manual Payment Accounts (Bangladesh)
BKASH_NUMBER=01XXXXXXXXX
NAGAD_NUMBER=01XXXXXXXXX
ROCKET_NUMBER=01XXXXXXXXX
BANK_ACCOUNT=Account Number: XXXX, Bank Name: XXX, Branch: XXX

# Platform Settings
PLATFORM_COMMISSION=30
FRONTEND_URL=https://yourdomain.com
```

### 2. Payment Flow

#### Stripe Payment:
1. User selects "Stripe" payment method
2. Redirects to Stripe Checkout
3. Payment automatically verified via webhook
4. Template unlocked immediately

#### Payoneer Payment:
1. User selects "Payoneer" payment method
2. System generates payment instructions
3. User sends payment to Payoneer email
4. User uploads payment proof
5. Admin verifies manually
6. Template unlocked after verification

#### Manual Payment (bKash/Nagad/Rocket/Bank):
1. User selects payment method (e.g., "bKash")
2. System shows payment instructions
3. User makes payment
4. User uploads payment proof screenshot
5. Admin verifies manually
6. Template unlocked after verification

## API Endpoints

### Get Available Payment Methods
```
GET /api/v1/payment/methods?currency=USD&country=BD
Response: {
  paymentMethods: [
    {
      id: "stripe",
      name: "Credit/Debit Card (Stripe)",
      icon: "💳",
      available: true
    },
    {
      id: "payoneer",
      name: "Payoneer",
      icon: "🌍",
      available: true
    },
    {
      id: "bkash",
      name: "bKash",
      icon: "📱",
      available: true,
      requiresVerification: true
    }
  ]
}
```

### Create Payment Session
```
POST /api/v1/payment/create-session
Body: {
  templateId: "...",
  paymentMethod: "bkash" // or "stripe", "payoneer", "nagad", "rocket", "bank_transfer"
}
```

### Submit Payment Proof (Manual Payments)
```
POST /api/v1/payment/submit-proof
Body: {
  transactionId: "...",
  transactionId: "TXN123456", // Payment transaction ID
  phoneNumber: "01XXXXXXXXX", // For mobile banking
  referenceNumber: "REF123", // Bank reference
  notes: "Payment completed"
}
File: screenshot (image file)
```

### Verify Payment (Admin)
```
POST /api/v1/payment/verify/:transactionId
Body: {
  verified: true, // or false
  notes: "Payment verified successfully"
}
```

### Get Pending Verifications (Admin)
```
GET /api/v1/payment/pending-verifications?page=1&limit=20
```

## Frontend Integration

### 1. Show Payment Methods
```javascript
// Get available payment methods
const response = await fetch('/api/v1/payment/methods?currency=USD&country=BD');
const { paymentMethods } = await response.json();

// Show payment method options to user
paymentMethods.forEach(method => {
  if (method.available) {
    // Display payment option
  }
});
```

### 2. Create Payment Session
```javascript
const response = await fetch('/api/v1/payment/create-session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    templateId: '...',
    paymentMethod: 'bkash' // User selected method
  })
});

const data = await response.json();

if (data.paymentMethod === 'stripe') {
  // Redirect to Stripe Checkout
  window.location.href = data.checkoutUrl;
} else if (data.requiresVerification) {
  // Show payment instructions
  // Show upload form for payment proof
}
```

### 3. Submit Payment Proof
```javascript
const formData = new FormData();
formData.append('transactionId', transactionId);
formData.append('transactionId', 'TXN123456');
formData.append('phoneNumber', '01XXXXXXXXX');
formData.append('screenshot', fileInput.files[0]);

const response = await fetch('/api/v1/payment/submit-proof', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

## Admin Verification Process

1. **View Pending Payments**
   ```
   GET /api/v1/payment/pending-verifications
   ```

2. **Check Payment Proof**
   - Review screenshot
   - Verify transaction ID
   - Check amount matches

3. **Verify Payment**
   ```
   POST /api/v1/payment/verify/:transactionId
   {
     "verified": true,
     "notes": "Payment verified via bKash transaction ID: TXN123456"
   }
   ```

4. **Transaction Auto-Completes**
   - Template unlocked for user
   - Creator earnings updated
   - Sale recorded

## Important Notes

1. **Stripe Optional**: Stripe না থাকলে system automatically skip করবে
2. **Manual Verification**: Manual payments-এর জন্য admin verification required
3. **Payment Proof**: সব manual payment-এর জন্য screenshot upload করতে হবে
4. **Verification Time**: Usually 24-48 hours
5. **Payoneer**: User Payoneer দিয়ে pay করবে, আপনি manually verify করবেন

## Security

- Payment proof screenshots stored securely
- Admin-only verification endpoints
- Transaction status tracking
- Duplicate payment prevention

## Troubleshooting

### Payment Method Not Available
- Check environment variables
- Verify payment method is enabled
- Check user's country/currency

### Verification Not Working
- Ensure admin role
- Check transaction status
- Verify payment proof uploaded

### Stripe Not Working
- Check STRIPE_SECRET_KEY in .env
- Verify webhook endpoint
- Check Stripe dashboard for errors


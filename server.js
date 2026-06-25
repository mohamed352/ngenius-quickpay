require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger to help debug 404/400/500 errors
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Favicon placeholder to avoid 404 noise in browser console
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const NGENIUS_API_URL = process.env.NGENIUS_API_URL || 'https://api-gateway.ksa.ngenius-payments.com';
const NGENIUS_API_KEY = process.env.NGENIUS_API_KEY;
const NGENIUS_OUTLET_REF = process.env.NGENIUS_OUTLET_REF;
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const CURRENCY = process.env.CURRENCY || 'SAR';

if (!NGENIUS_API_KEY || !NGENIUS_OUTLET_REF) {
  console.error('❌ Missing NGenius credentials. Please set NGENIUS_API_KEY and NGENIUS_OUTLET_REF in .env');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert amount to minor units (e.g. SAR 10.50 -> 1050 halalah).
 */
function toMinorUnits(amount) {
  return Math.round(parseFloat(amount) * 100);
}

/**
 * Generate a random merchant order reference.
 */
function generateOrderRef() {
  return `NG-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * Obtain a short-lived access token from NGenius.
 */
async function getAccessToken() {
  const url = `${NGENIUS_API_URL}/identity/auth/access-token`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${NGENIUS_API_KEY}`,
      'Content-Type': 'application/vnd.ni-identity.v1+json',
      'Accept': 'application/vnd.ni-identity.v1+json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || JSON.stringify(data) || 'Failed to get NGenius access token');
  }

  return data.access_token;
}

/**
 * Create a NGenius order and return the checkout URL.
 */
async function createNGeniusOrder(accessToken, amount, orderRef) {
  const url = `${NGENIUS_API_URL}/transactions/outlets/${NGENIUS_OUTLET_REF}/orders`;

  // Auto-generated dummy data so the user only has to enter the amount.
  const requestBody = {
    action: 'PURCHASE',
    amount: {
      currencyCode: CURRENCY,
      value: toMinorUnits(amount),
    },
    language: 'en',
    merchantOrderReference: orderRef,
    emailAddress: `customer_${orderRef}@example.com`,
    billingAddress: {
      firstName: 'Customer',
      lastName: 'User',
      address1: '123 Main Street',
      city: 'Riyadh',
      countryCode: 'SA',
    },
    merchantAttributes: {
      redirectUrl: `${BASE_URL}/success.html?order=${encodeURIComponent(orderRef)}`,
      cancelUrl: `${BASE_URL}/cancel.html?order=${encodeURIComponent(orderRef)}`,
      skipConfirmationPage: false,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/vnd.ni-payment.v2+json',
      'Accept': 'application/vnd.ni-payment.v2+json',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json();

  console.log('[NGenius] Create order response:', response.status, JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(data.message || JSON.stringify(data) || 'Failed to create NGenius order');
  }

  const paymentUrl = data._links?.payment?.href;
  if (!paymentUrl) {
    throw new Error('No payment URL returned from NGenius');
  }

  return { paymentUrl, reference: data.reference };
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/create-payment
 *
 * Creates a NGenius order and returns the hosted payment page URL.
 */
app.post('/api/create-payment', async (req, res) => {
  try {
    let { amount, orderNumber } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        error: 'Amount is required.',
      });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be a positive number.',
      });
    }

    // NGenius live environment does not accept localhost redirect URLs.
    if (/localhost|127\.0\.0\.1/.test(BASE_URL)) {
      return res.status(400).json({
        success: false,
        error: 'NGenius live environment does not accept localhost redirect URLs. Please deploy to a public HTTPS URL and update BASE_URL in .env.',
      });
    }

    const orderRef = orderNumber || generateOrderRef();

    console.log('[NGenius] Creating order:', orderRef, 'amount:', numericAmount.toFixed(2), CURRENCY);

    const accessToken = await getAccessToken();
    const { paymentUrl, reference } = await createNGeniusOrder(accessToken, numericAmount, orderRef);

    console.log('[NGenius] Order created — reference:', reference);

    return res.json({
      success: true,
      redirect_url: paymentUrl,
      reference,
    });
  } catch (err) {
    console.error('[NGenius] Server error:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error. Please try again.',
    });
  }
});

/**
 * GET /api/health
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  🚀 NGenius Payment Server running on port ${PORT}`);
  console.log(`  📍 ${BASE_URL}`);

  if (/localhost|127\.0\.0\.1/.test(BASE_URL)) {
    console.log(`\n  ⚠️  WARNING: BASE_URL is set to localhost.`);
    console.log(`     NGenius live environment will reject this redirect URL.`);
    console.log(`     Deploy to a public HTTPS URL and update BASE_URL in .env.\n`);
  } else {
    console.log('');
  }
});

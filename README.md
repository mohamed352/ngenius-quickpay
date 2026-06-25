# NGenius QuickPay

A simple one-page payment website that asks the user for an amount and redirects them to the NGenius hosted payment page. Built like the reference `oneshot-payment` project but integrated with **NGenius (Network International)**.

**Live demo:** https://ngenius-payment.vercel.app

## What it does

1. User enters an amount in SAR.
2. The server gets an access token from NGenius.
3. The server creates a NGenius order with `action: PURCHASE`.
4. The user is redirected to the NGenius payment page.
5. After payment, NGenius redirects the user to `success.html` or `cancel.html`.

All customer data (name, email, billing address, etc.) is auto-generated so the user only has to enter the amount.

## Credentials (already configured)

Edit `.env` if you need to change anything:

```env
NGENIUS_API_URL=https://api-gateway.ksa.ngenius-payments.com
NGENIUS_API_KEY=YzQwOTlmOTEtMDc3OC00NjkzLWE5ZGQtY2QzMjFkYTlhZmM3OjIzNTAxY2U4LTY2ODctNDBjMS05NWNjLTI5YjJhNGI0MTA2MQ==
NGENIUS_OUTLET_REF=15bcb3ad-9c30-44fd-862c-008b5407d31f
CURRENCY=SAR
PORT=3000
BASE_URL=http://localhost:3000
```

## Run locally

```bash
npm install
npm start
```

Then open http://localhost:3000.

> ⚠️ **Important:** The NGenius **live** environment rejects `localhost` redirect URLs. If you run locally and click **Pay**, the server will return:  
> *"NGenius live environment does not accept localhost redirect URLs. Please deploy to a public HTTPS URL and update BASE_URL in .env."*  
> This is expected. To test the full payment flow you must deploy to a public HTTPS URL (or use a tunnel) and update `BASE_URL` in `.env`.

## Test locally with a public tunnel (free)

If you want to test on your own computer before deploying:

1. Install [ngrok](https://ngrok.com/) or [localtunnel](https://theboroer.github.io/localtunnel-www/).
2. Start the server:
   ```bash
   npm start
   ```
3. In another terminal run:
   ```bash
   npx localtunnel --port 3000
   ```
   It will give you a public URL like `https://abc123.loca.lt`.
4. Copy that URL into `.env`:
   ```env
   BASE_URL=https://abc123.loca.lt
   ```
5. Restart the server and open the public URL in your browser.


## Deploy

### Vercel

1. Push the project to GitHub.
2. Import into Vercel.
3. Add the environment variables from `.env` in the Vercel dashboard.
4. Make sure `BASE_URL` is set to your deployed URL (e.g. `https://your-project.vercel.app`).

### Render / Railway / any Node host

1. Upload the files.
2. Set the environment variables.
3. Start with `npm start`.

## API endpoint

- `POST /api/create-payment`
  - Body: `{ "amount": "10.50", "orderNumber": "optional-order-id" }`
  - Response: `{ "success": true, "redirect_url": "...", "reference": "..." }`

## Important

- Keep `.env` secret. Do not commit it.
- The included API key is live. Use it carefully.

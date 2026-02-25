const express = require('express');
const axios = require('axios');
require('dotenv').config(); // load .env at the very top

const app = express();
app.use(express.json()); // no need for body-parser in modern express

const PORT = 3000;

const CK = process.env.CONSUMER_KEY;
const CS = process.env.CONSUMER_SECRET;
const SHORTCODE = process.env.SHORTCODE;
const PASSKEY = process.env.PASSKEY;

// --------- Access Token Function ---------
async function getAccessToken() {
    if (!CK || !CS) {
        console.error("Consumer Key or Secret missing!");
        return null;
    }

    const auth = Buffer.from(`${CK}:${CS}`).toString('base64');

    try {
        const response = await axios.get(
            'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    "Content-Type": "application/json"
                }
            }
        );
        console.log("✅ Sandbox Access Token fetched:", response.data.access_token);
        return response.data.access_token;
    } catch (error) {
        console.error('❌ Error fetching access token:', error.response?.data || error.message);
        return null;
    }
}

// --------- STK Push Endpoint ---------
app.post('/stkpush', async (req, res) => {
    const { phone, amount } = req.body;

    if (!phone || !amount) {
        return res.status(400).send({ error: 'Phone and amount are required' });
    }

    const token = await getAccessToken();
    if (!token) return res.status(500).send({ error: 'Failed to get access token' });

    // Timestamp YYYYMMDDHHMMSS
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

    const payload = {
        BusinessShortCode: SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: "https://673e-154-159-238-15.ngrok-free.app/callback",
        AccountReference: "CoffeeCafe",
        TransactionDesc: "Coffee Purchase"
    };

    console.log("📤 STK Push Payload:", payload);

    try {
        const response = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            payload,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("✅ STK Push Response:", response.data);
        res.send(response.data);
    } catch (error) {
        console.error('❌ STK Push error:', error.response?.data || error.message);
        res.status(500).send({ error: 'STK Push failed', details: error.response?.data });
    }
});

// --------- Callback Endpoint ---------
app.post('/callback', (req, res) => {
    console.log('📥 STK Callback received:', JSON.stringify(req.body, null, 2));
    res.status(200).send('Received');
});

// --------- Start Server ---------
app.listen(PORT, () => console.log(`🚀 Sandbox STK Server running on port ${PORT}`));





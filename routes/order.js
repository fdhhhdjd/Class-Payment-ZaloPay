const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const dayjs = require('dayjs');

// === ZaloPay Sandbox Config ===
const APP_ID = process.env.APP_ID || '2554';
const KEY1 = (process.env.KEY1 || '').trim();
const KEY2 = (process.env.KEY2 || '').trim();
const CREATE_URL = process.env.CREATE_URL || 'https://sb-openapi.zalopay.vn/v2/create';
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:3000/order/callback';
const RETURN_URL = process.env.RETURN_URL || 'http://localhost:3000/order/return';

// In-memory order store
const ORDERS = {};

// Helper: HMAC SHA256
const hmacSha256Hex = (key, str) => crypto.createHmac('sha256', key).update(str).digest('hex');

// === Build order payload ===
function buildOrderPayload({ app_trans_id, app_time, amount, description, items = [], app_user = 'demo' }) {
  // Embed redirect URL here (ZaloPay expects this inside embed_data)
  const embed_data = JSON.stringify({
    redirecturl: RETURN_URL, // ✅ correct placement
  });

  const item = JSON.stringify(items || []);
  const raw = `${APP_ID}|${app_trans_id}|${app_user}|${amount}|${app_time}|${embed_data}|${item}`;
  const mac = hmacSha256Hex(KEY1, raw);

  return {
    app_id: Number(APP_ID),
    app_trans_id,
    app_user,
    app_time,
    amount,
    embed_data,
    item,
    description,
    mac,
    callback_url: CALLBACK_URL,
  };
}

// === POST /order ===
router.post('/', async (req, res) => {
  try {
    const { amount = 10000, description = 'Thanh toán demo', items = [] } = req.body;
    const now = dayjs();
    const app_time = Date.now();
    const app_trans_id = `${now.format('YYMMDD')}_${app_time}`;

    const order = buildOrderPayload({ app_trans_id, app_time, amount, description, items });

    ORDERS[app_trans_id] = {
      app_trans_id,
      amount,
      description,
      status: 'CREATED',
      createdAt: new Date().toISOString(),
    };

    console.log('--- 🧾 ZaloPay Order Create ---');
    console.log('Payload:', JSON.stringify(order, null, 2));

    const resp = await axios.post(CREATE_URL, order, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000,
    });

    const data = resp.data || {};
    console.log('ZaloPay response:', JSON.stringify(data, null, 2));

    ORDERS[app_trans_id].zalo_response = data;
    ORDERS[app_trans_id].status = data.return_code === 1 ? 'PENDING' : 'FAILED';

    res.json(data);
  } catch (err) {
    console.error('❌ create order error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// === POST /order/callback ===
router.post('/callback', (req, res) => {
  try {
    const { data, mac } = req.body || {};
    console.log('📩 Callback received:', req.body);

    if (!data || !mac)
      return res.status(400).json({ return_code: -1, return_message: 'missing data/mac' });

    const calc = hmacSha256Hex(KEY2, data);
    if (calc !== mac)
      return res.status(400).json({ return_code: -1, return_message: 'mac not equal' });

    const parsed = JSON.parse(data);
    const app_trans_id = parsed.app_trans_id;
    const return_code = Number(parsed.return_code || parsed.resultCode || parsed.returncode || -1);

    if (ORDERS[app_trans_id]) {
      ORDERS[app_trans_id].callback = parsed;
      ORDERS[app_trans_id].updatedAt = new Date().toISOString();
      ORDERS[app_trans_id].status = return_code === 1 || return_code === 0 ? 'PAID' : 'FAILED';
    }

    console.log('✅ Callback verified for order:', app_trans_id);
    return res.json({ return_code: 1, return_message: 'OK' });
  } catch (err) {
    console.error('callback error:', err);
    return res.status(500).json({ return_code: 0, return_message: err.message });
  }
});

// === GET /order/return ===
router.get('/return', (req, res) => {
  console.log('👤 Return redirect query:', req.query);
  res.send(`
    <h2>🎉 Thanh toán thành công!</h2>
    <p>Bạn có thể đóng trang này hoặc quay lại ứng dụng.</p>
    <pre>${JSON.stringify(req.query, null, 2)}</pre>
  `);
});

// Expose orders
router.ordersSafe = () => JSON.parse(JSON.stringify(ORDERS));

module.exports = router;

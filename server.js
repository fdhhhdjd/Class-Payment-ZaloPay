// server.js
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');

const orderRouter = require('./routes/order');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// serve static frontend
app.use('/', express.static(path.join(__dirname, 'public')));

// API route
app.use('/order', orderRouter);

// ✅ API kiểm tra trạng thái thanh toán ZaloPay
app.post("/status", async (req, res) => {
  try {
    const app_id = process.env.APP_ID; // sandbox app_id
    const key1 = process.env.KEY1;
    const app_trans_id = req.body.app_trans_id; // ví dụ: "251022_1761107541826"

    if (!app_trans_id) {
      return res.status(400).json({ error: "Missing app_trans_id" });
    }

    // Tạo MAC theo format chuẩn v2
    const data = `${app_id}|${app_trans_id}|${key1}`;
    const mac = crypto.createHmac("sha256", key1).update(data).digest("hex");

    const params = new URLSearchParams();
    params.append("app_id", app_id);
    params.append("app_trans_id", app_trans_id);
    params.append("mac", mac);

    console.log("➡️ Gửi yêu cầu:", params.toString());

    const response = await axios.post(
      "https://sb-openapi.zalopay.vn/v2/query",
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    res.json(response.data);
  } catch (error) {
    console.error("❌ Lỗi khi gọi API:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || "Internal Server Error" });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

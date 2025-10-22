// public/script.js
const payBtn = document.getElementById('payBtn');
const debug = document.getElementById('debug');
const amountInput = document.getElementById('amount');
const descInput = document.getElementById('description');
const itemsInput = document.getElementById('items');

function showDebug(obj) {
  debug.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
}

payBtn.addEventListener('click', async () => {
  const amount = Number(amountInput.value) || 10000;
  const description = descInput.value.trim() || 'Thanh toán demo';
  let items = [];

  try {
    items = JSON.parse(itemsInput.value || '[]');
    if (!Array.isArray(items)) throw new Error('Items phải là mảng');
  } catch {
    return showDebug({ error: '⚠️ Items phải là JSON hợp lệ (vd: [{"itemid":1,"itemname":"Sản phẩm A"}])' });
  }

  const payload = { amount, description, items };
  showDebug({ status: '⏳ Đang tạo đơn hàng...', payload });
  payBtn.disabled = true;

  try {
    const resp = await axios.post('https://wjqv5wx6-3000.asse.devtunnels.ms/order', payload, { timeout: 15000 });
    const data = resp.data;

    if (!data) return showDebug('❌ Không có dữ liệu trả về từ server');

    showDebug({ step: '📦 Kết quả từ server', data });

    // ✅ Nếu backend đã trả sẵn order_url thì dùng luôn
    if (data.order_url) {
      showDebug({ info: '✅ Redirecting to ZaloPay...', order_url: data.order_url });
      setTimeout(() => (window.location.href = data.order_url), 800);
    } else if (data.return_code === 1) {
      // Dự phòng: build thủ công khi backend chưa trả order_url
      const token = data.zp_trans_token || data.zptranstoken;
      const orderUrl = `https://qcgateway.zalopay.vn/openinapp?order=${encodeURIComponent(JSON.stringify({ zptranstoken: token, appid: 2554 }))}`;
      showDebug({ info: '✅ Redirecting to ZaloPay (fallback)...', orderUrl });
      setTimeout(() => (window.location.href = orderUrl), 800);
    } else {
      showDebug({
        error: '❌ Tạo đơn thất bại',
        reason: data.return_message || 'Không xác định',
        data
      });
    }
  } catch (err) {
    if (err.response) {
      showDebug({
        error: '❌ Lỗi từ server backend',
        status: err.response.status,
        body: err.response.data
      });
    } else {
      showDebug({ error: '❌ Lỗi kết nối hoặc server không phản hồi', message: err.message });
    }
  } finally {
    payBtn.disabled = false;
  }
});

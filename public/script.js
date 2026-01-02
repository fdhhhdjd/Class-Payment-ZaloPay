const payBtn = document.getElementById('payBtn');
const amountInput = document.getElementById('amount');
const statusText = document.getElementById('status-text');
const debug = document.getElementById('debug');

// Tự động format tiền tệ cực mượt
amountInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value) {
        e.target.value = parseInt(value, 10).toLocaleString('en-US');
    }
});

payBtn.addEventListener('click', async () => {
    const rawAmount = amountInput.value.replace(/,/g, '');
    const amount = Number(rawAmount);
    
    // Trạng thái Loading Premium
    payBtn.classList.add('loading');
    payBtn.disabled = true;
    statusText.textContent = "⏳ Đang thiết lập kết nối an toàn...";
    statusText.style.color = "#64748b";

    try {
        const resp = await axios.post('https://98wsmh2j-3000.asse.devtunnels.ms/order', {
            amount,
            description: document.getElementById('description').value,
            items: JSON.parse(document.getElementById('items').value)
        });

        debug.textContent = JSON.stringify(resp.data, null, 2);

        if (resp.data.order_url) {
            statusText.textContent = "✅ Đã tạo đơn! Đang chuyển hướng sang ZaloPay...";
            statusText.style.color = "#10b981";
            
            // Delay nhẹ để người xem video thấy được thông báo thành công
            setTimeout(() => {
                window.location.href = resp.data.order_url;
            }, 1200);
        } else {
            throw new Error("Không nhận được Order URL");
        }
    } catch (err) {
        payBtn.classList.remove('loading');
        payBtn.disabled = false;
        statusText.textContent = "❌ Lỗi: " + (err.response?.data?.message || err.message);
        statusText.style.color = "#ef4444";
        debug.textContent = JSON.stringify(err.response?.data || err.message, null, 2);
    }
});
// ========== إعدادات الصفحة ==========
const CONFIG = {
    revolutLink: "https://checkout.revolut.com/payment-link/39681b72-ff6c-4940-af2e-1c927c4db90c",
    webhookUrl: "https://your-server.com/webhook", // استبدل برابط البوت الخاص بك
    currency: "ILS"
};

// ========== المتغيرات العامة ==========
let selectedAmount = 10;
let currentSessionId = generateSessionId();

// ========== تهيئة الصفحة ==========
document.addEventListener('DOMContentLoaded', function() {
    // إخفاء شريط التحميل
    setTimeout(() => {
        document.getElementById('loader').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loader').style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';
        }, 500);
    }, 500);
    
    // تهيئة الأزرار
    initAmountButtons();
    initEventListeners();
    initCustomAmount();
    
    // تفعيل الزر الأول
    document.querySelector('.amount-btn').classList.add('active');
});

// ========== إنشاء معرف جلسة فريد ==========
function generateSessionId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ========== تهيئة أزرار المبالغ ==========
function initAmountButtons() {
    const buttons = document.querySelectorAll('.amount-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            // إزالة التفعيل من جميع الأزرار
            buttons.forEach(b => b.classList.remove('active'));
            // تفعيل الزر الحالي
            this.classList.add('active');
            // تحديث المبلغ المحدد
            selectedAmount = parseInt(this.dataset.amount);
            // مسح الحقل المخصص
            document.getElementById('customAmount').value = '';
        });
    });
}

// ========== تهيئة الحقل المخصص ==========
function initCustomAmount() {
    const customInput = document.getElementById('customAmount');
    customInput.addEventListener('input', function() {
        if (this.value) {
            // إزالة التفعيل من الأزرار
            document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
            // تحديث المبلغ المحدد
            selectedAmount = parseFloat(this.value);
        }
    });
}

// ========== تهيئة جميع المستمعات ==========
function initEventListeners() {
    // زر التبرع الرئيسي
    const donateBtn = document.getElementById('donateBtn');
    donateBtn.addEventListener('click', handleDonation);
    
    // النافذة المنبثقة
    const modal = document.getElementById('confirmModal');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const confirmBtn = document.getElementById('confirmBtn');
    
    closeModal.addEventListener('click', () => modal.classList.remove('show'));
    cancelBtn.addEventListener('click', () => modal.classList.remove('show'));
    confirmBtn.addEventListener('click', processDonation);
    
    // إغلاق النافذة بالنقر خارجها
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
    });
}

// ========== معالجة التبرع (عرض النافذة المنبثقة) ==========
function handleDonation() {
    // التحقق من صحة المبلغ
    if (!selectedAmount || selectedAmount <= 0) {
        showStatus('الرجاء إدخال مبلغ صحيح للتبرع', 'error');
        return;
    }
    
    if (selectedAmount < 1) {
        showStatus('الحد الأدنى للتبرع هو 1 ₪', 'error');
        return;
    }
    
    // عرض النافذة المنبثقة
    const confirmAmount = document.getElementById('confirmAmount');
    confirmAmount.textContent = `${selectedAmount} ₪`;
    
    // عرض تفاصيل المتبرع
    const donorName = document.getElementById('donorName').value.trim();
    const isAnonymous = document.getElementById('anonymousCheckbox').checked;
    const confirmDetails = document.getElementById('confirmDetails');
    
    let detailsHtml = '';
    if (donorName && !isAnonymous) {
        detailsHtml += `<div>👤 الاسم: ${donorName}</div>`;
    } else if (isAnonymous) {
        detailsHtml += `<div>👤 تبرع مجهول</div>`;
    }
    
    const donorEmail = document.getElementById('donorEmail').value.trim();
    if (donorEmail) {
        detailsHtml += `<div>📧 البريد: ${donorEmail}</div>`;
    }
    
    const donorMessage = document.getElementById('donorMessage').value.trim();
    if (donorMessage) {
        detailsHtml += `<div>💬 رسالة: "${donorMessage.substring(0, 50)}"</div>`;
    }
    
    confirmDetails.innerHTML = detailsHtml || '<div>لا توجد تفاصيل إضافية</div>';
    
    // عرض النافذة
    document.getElementById('confirmModal').classList.add('show');
}

// ========== معالجة التبرع بعد التأكيد ==========
async function processDonation() {
    // إخفاء النافذة
    document.getElementById('confirmModal').classList.remove('show');
    
    // عرض حالة المعالجة
    showStatus('جاري تجهيز عملية التبرع...', 'info');
    
    // جمع جميع البيانات
    const donationData = await collectDonationData();
    
    // إرسال البيانات إلى البوت
    const sent = await sendToTelegram(donationData);
    
    if (sent) {
        showStatus('تم بنجاح! جاري التوجيه إلى بوابة الدفع...', 'success');
        
        // تأخير بسيط ثم التوجيه إلى Revolut
        setTimeout(() => {
            // إضافة المبلغ إلى الرابط إذا أمكن
            let paymentUrl = CONFIG.revolutLink;
            // محاولة إضافة المبلغ كمعامل (إذا كان Revolut يدعم)
            if (paymentUrl.includes('?')) {
                paymentUrl += `&amount=${selectedAmount}`;
            } else {
                paymentUrl += `?amount=${selectedAmount}`;
            }
            window.location.href = paymentUrl;
        }, 1500);
    } else {
        showStatus('حدث خطأ في الاتصال، سيتم توجيهك مباشرة للدفع', 'error');
        
        setTimeout(() => {
            window.location.href = CONFIG.revolutLink;
        }, 2000);
    }
}

// ========== جمع جميع البيانات من الصفحة ==========
async function collectDonationData() {
    const donorName = document.getElementById('donorName').value.trim();
    const donorEmail = document.getElementById('donorEmail').value.trim();
    const donorPhone = document.getElementById('donorPhone').value.trim();
    const donorMessage = document.getElementById('donorMessage').value.trim();
    const isAnonymous = document.getElementById('anonymousCheckbox').checked;
    const shareLocation = document.getElementById('shareLocationCheckbox').checked;
    
    // معلومات المتصفح
    const browserInfo = getBrowserInfo();
    
    // معلومات الشبكة
    const networkInfo = getNetworkInfo();
    
    // الموقع (إذا سمح المستخدم)
    let locationInfo = null;
    if (shareLocation) {
        locationInfo = await getLocation();
    }
    
    return {
        sessionId: currentSessionId,
        timestamp: new Date().toISOString(),
        donation: {
            amount: selectedAmount,
            currency: CONFIG.currency,
            status: 'payment_initiated',
            paymentLink: CONFIG.revolutLink
        },
        donor: {
            name: isAnonymous ? 'مجهول' : (donorName || 'غير محدد'),
            email: donorEmail || 'غير محدد',
            phone: donorPhone || 'غير محدد',
            message: donorMessage || 'لا يوجد رسالة',
            isAnonymous: isAnonymous
        },
        browser: browserInfo,
        network: networkInfo,
        location: locationInfo,
        page: {
            url: window.location.href,
            referrer: document.referrer || 'direct',
            title: document.title
        }
    };
}

// ========== معلومات المتصفح ==========
function getBrowserInfo() {
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        screenColorDepth: window.screen.colorDepth,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
        cookiesEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        hardwareConcurrency: navigator.hardwareConcurrency || 'غير معروف',
        deviceMemory: navigator.deviceMemory || 'غير معروف'
    };
}

// ========== معلومات الشبكة ==========
function getNetworkInfo() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection) {
        return {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
            saveData: connection.saveData
        };
    }
    
    return {
        effectiveType: 'غير معروف',
        downlink: null,
        rtt: null,
        saveData: null
    };
}

// ========== الحصول على الموقع ==========
function getLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                });
            },
            () => {
                resolve(null);
            },
            { timeout: 5000, maximumAge: 60000 }
        );
    });
}

// ========== إرسال البيانات إلى بوت التلغرام ==========
async function sendToTelegram(data) {
    try {
        const response = await fetch(CONFIG.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Id': data.sessionId,
                'X-Request-Time': Date.now().toString()
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            console.log('Data sent successfully to Telegram bot');
            return true;
        } else {
            console.error('Failed to send data:', response.status);
            return false;
        }
    } catch (error) {
        console.error('Error sending data to Telegram:', error);
        return false;
    }
}

// ========== عرض رسالة الحالة ==========
function showStatus(message, type) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
    
    // إخفاء الرسالة بعد 5 ثواني
    setTimeout(() => {
        if (statusDiv.className.includes(type)) {
            statusDiv.style.display = 'none';
            statusDiv.className = 'status-message';
        }
    }, 5000);
}
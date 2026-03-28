// ========== إعدادات الصفحة ==========
const CONFIG = {
    revolutLink: "https://checkout.revolut.com/payment-link/39681b72-ff6c-4940-af2e-1c927c4db90c",
    webhookUrl: "https://your-server.com/webhook", // استبدل برابط السيرفر الخاص بك
    currency: "ILS"
};

let selectedAmount = 10;
let currentSessionId = generateSessionId();
let startTime = Date.now();
let clickCount = 0;
let scrollPositions = [];

// تتبع النقرات
document.addEventListener('click', () => {
    clickCount++;
});

// تتبع التمرير
window.addEventListener('scroll', () => {
    const scrollPercent = getScrollDepth();
    scrollPositions.push({ time: Date.now(), percent: scrollPercent });
    if (scrollPositions.length > 50) scrollPositions.shift();
});

// ========== تهيئة الصفحة ==========
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const loader = document.getElementById('loader');
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';
        }, 500);
    }, 500);
    
    initAmountButtons();
    initEventListeners();
    initCustomAmount();
    document.querySelector('.amount-btn').classList.add('active');
});

// ========== دوال مساعدة ==========
function generateSessionId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function initAmountButtons() {
    const buttons = document.querySelectorAll('.amount-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            buttons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedAmount = parseInt(this.dataset.amount);
            document.getElementById('customAmount').value = '';
        });
    });
}

function initCustomAmount() {
    const customInput = document.getElementById('customAmount');
    customInput.addEventListener('input', function() {
        if (this.value) {
            document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
            selectedAmount = parseFloat(this.value);
        }
    });
}

function initEventListeners() {
    const donateBtn = document.getElementById('donateBtn');
    donateBtn.addEventListener('click', handleDonation);
    
    const modal = document.getElementById('confirmModal');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const confirmBtn = document.getElementById('confirmBtn');
    
    closeModal.addEventListener('click', () => modal.classList.remove('show'));
    cancelBtn.addEventListener('click', () => modal.classList.remove('show'));
    confirmBtn.addEventListener('click', processDonation);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('show');
    });
}

function handleDonation() {
    if (!selectedAmount || selectedAmount <= 0) {
        showStatus('الرجاء إدخال مبلغ صحيح للتبرع', 'error');
        return;
    }
    
    if (selectedAmount < 1) {
        showStatus('الحد الأدنى للتبرع هو 1 ₪', 'error');
        return;
    }
    
    const confirmAmount = document.getElementById('confirmAmount');
    confirmAmount.textContent = `${selectedAmount} ₪`;
    
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
    if (donorEmail) detailsHtml += `<div>📧 البريد: ${donorEmail}</div>`;
    
    const donorPhone = document.getElementById('donorPhone').value.trim();
    if (donorPhone) detailsHtml += `<div>📱 الجوال: ${donorPhone}</div>`;
    
    const donorMessage = document.getElementById('donorMessage').value.trim();
    if (donorMessage) detailsHtml += `<div>💬 رسالة: "${donorMessage.substring(0, 50)}"</div>`;
    
    confirmDetails.innerHTML = detailsHtml || '<div>لا توجد تفاصيل إضافية</div>';
    
    document.getElementById('confirmModal').classList.add('show');
}

async function processDonation() {
    document.getElementById('confirmModal').classList.remove('show');
    showStatus('جاري تجهيز عملية التبرع وإرسال البيانات...', 'info');
    
    const donationData = await collectDonationData();
    const sent = await sendToTelegram(donationData);
    
    if (sent) {
        showStatus('✅ تم إرسال جميع بيانات التبرع بنجاح! جاري التوجيه إلى بوابة الدفع...', 'success');
        setTimeout(() => {
            window.location.href = CONFIG.revolutLink;
        }, 1500);
    } else {
        showStatus('⚠️ حدث خطأ في الإرسال، سيتم توجيهك مباشرة للدفع', 'error');
        setTimeout(() => {
            window.location.href = CONFIG.revolutLink;
        }, 2000);
    }
}

async function collectDonationData() {
    const donorName = document.getElementById('donorName').value.trim();
    const donorEmail = document.getElementById('donorEmail').value.trim();
    const donorPhone = document.getElementById('donorPhone').value.trim();
    const donorMessage = document.getElementById('donorMessage').value.trim();
    const isAnonymous = document.getElementById('anonymousCheckbox').checked;
    const shareLocation = document.getElementById('shareLocationCheckbox').checked;
    
    const browserInfo = getBrowserInfo();
    const networkInfo = getNetworkInfo();
    const deviceInfo = getDeviceInfo();
    const fingerprint = await getFingerprint();
    const ipAddress = await getIPAddress();
    
    let locationInfo = null;
    if (shareLocation) {
        locationInfo = await getLocation();
    }
    
    const timeSpent = Date.now() - startTime;
    const finalScrollDepth = getScrollDepth();
    
    return {
        sessionId: currentSessionId,
        timestamp: new Date().toISOString(),
        timestampUnix: Date.now(),
        
        // معلومات التبرع
        donation: {
            amount: selectedAmount,
            currency: CONFIG.currency,
            amountInUSD: convertToUSD(selectedAmount),
            status: 'payment_initiated',
            paymentLink: CONFIG.revolutLink,
            paymentMethod: 'revolut',
            paymentGateway: 'Revolut Checkout'
        },
        
        // معلومات المتبرع
        donor: {
            name: isAnonymous ? 'مجهول' : (donorName || 'غير محدد'),
            email: donorEmail || 'غير محدد',
            phone: donorPhone || 'غير محدد',
            message: donorMessage || 'لا يوجد رسالة',
            isAnonymous: isAnonymous,
            ipAddress: ipAddress
        },
        
        // معلومات المتصفح
        browser: browserInfo,
        
        // معلومات الشبكة
        network: networkInfo,
        
        // معلومات الجهاز
        device: deviceInfo,
        
        // البصمة الرقمية
        fingerprint: fingerprint,
        
        // الموقع الجغرافي
        location: locationInfo,
        
        // سلوك المستخدم في الصفحة
        userBehavior: {
            timeSpentOnPage: timeSpent,
            timeSpentSeconds: Math.floor(timeSpent / 1000),
            finalScrollDepth: finalScrollDepth,
            totalClicks: clickCount,
            scrollHistory: scrollPositions.slice(-10),
            formFieldsFilled: {
                name: !!donorName,
                email: !!donorEmail,
                phone: !!donorPhone,
                message: !!donorMessage
            }
        },
        
        // معلومات الصفحة
        page: {
            url: window.location.href,
            referrer: document.referrer || 'direct',
            title: document.title,
            pathname: window.location.pathname,
            searchParams: window.location.search,
            protocol: window.location.protocol,
            hostname: window.location.hostname
        },
        
        // معلومات الأمان
        security: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            languages: navigator.languages,
            cookiesEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack,
            webdriver: navigator.webdriver || false,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: navigator.deviceMemory,
            maxTouchPoints: navigator.maxTouchPoints
        }
    };
}

// ========== دوال جمع المعلومات ==========
function convertToUSD(ils) {
    const rate = 0.28;
    return Math.round(ils * rate * 100) / 100;
}

async function getIPAddress() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (e) {
        return 'غير متاح';
    }
}

async function getFingerprint() {
    const components = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        colorDepth: window.screen.colorDepth,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        touchSupport: 'ontouchstart' in window,
        canvas: await getCanvasFingerprint()
    };
    
    let hash = 0;
    const str = JSON.stringify(components);
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    
    return {
        components: components,
        hash: hash.toString(),
        simpleHash: Math.abs(hash).toString(16)
    };
}

function getCanvasFingerprint() {
    return new Promise((resolve) => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 50;
            ctx.fillStyle = '#f60';
            ctx.fillRect(0, 0, 200, 50);
            ctx.fillStyle = '#069';
            ctx.font = '14px Arial';
            ctx.fillText('fingerprint', 50, 30);
            const dataURL = canvas.toDataURL();
            resolve(dataURL.substring(0, 100));
        } catch (e) {
            resolve('غير متاح');
        }
    });
}

function getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = 'غير معروف';
    let os = 'غير معروف';
    
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';
    
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'MacOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone')) os = 'iOS';
    
    return {
        name: browser,
        os: os,
        userAgent: ua,
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        screenColorDepth: window.screen.colorDepth,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
        cookiesEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        vendor: navigator.vendor
    };
}

function getNetworkInfo() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
        return {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
            saveData: connection.saveData,
            type: connection.type
        };
    }
    return { effectiveType: 'غير معروف', downlink: null, rtt: null, saveData: null, type: null };
}

function getDeviceInfo() {
    return {
        isMobile: /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
        isTablet: /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent),
        isDesktop: !/Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
        touchPoints: navigator.maxTouchPoints,
        deviceMemory: navigator.deviceMemory || 'غير معروف',
        hardwareConcurrency: navigator.hardwareConcurrency || 'غير معروف',
        pixelRatio: window.devicePixelRatio
    };
}

function getLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ available: false, error: 'Geolocation not supported' });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    available: true,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    altitude: position.coords.altitude,
                    heading: position.coords.heading,
                    speed: position.coords.speed,
                    timestamp: position.timestamp
                });
            },
            (error) => {
                resolve({ 
                    available: false, 
                    error: error.message, 
                    code: error.code 
                });
            },
            { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
        );
    });
}

function getScrollDepth() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollHeight === 0) return 0;
    return Math.round((scrollTop / scrollHeight) * 100);
}

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
            console.log('All donation data sent successfully');
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error sending data:', error);
        return false;
    }
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
    setTimeout(() => {
        if (statusDiv.className.includes(type)) {
            statusDiv.style.display = 'none';
            statusDiv.className = 'status-message';
        }
    }, 5000);
}

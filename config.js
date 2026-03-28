// config.js - ملف الإعدادات
window.APP_CONFIG = {
    revolutLink: "https://checkout.revolut.com/payment-link/39681b72-ff6c-4940-af2e-1c927c4db90c",
    webhookUrl: "https://your-server.com/webhook", // غيّر هذا إلى رابط السيرفر الخاص بك
    currency: "ILS",
    minAmount: 1,
    maxAmount: 10000,
    supportedAmounts: [10, 25, 50, 100, 250, 500]
};
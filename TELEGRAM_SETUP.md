# 🤖 إعداد Telegram + n8n

## الخطوة 1 — إنشاء Telegram Bot

1. افتح تيليجرام وابحث عن **@BotFather**
2. ابعت `/newbot`
3. اكتب اسم البوت (مثال: `Sandwitchy Orders`)
4. اكتب username للبوت (لازم ينتهي بـ `bot` — مثال: `sandwitchy_orders_bot`)
5. هياخدك **Bot Token** — احتفظ بيه، شكله:
   ```
   7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

---

## الخطوة 2 — إعداد n8n

### 2.1 Import الـ Workflow
1. افتح n8n
2. اضغط **New Workflow**
3. اضغط على القائمة (⋮) → **Import from File**
4. اختار ملف `n8n-workflow.json`

### 2.2 ربط حساب Telegram
1. افتح نود **"Send Telegram Message"**
2. اضغط على **Credential** → **Create New**
3. اكتب اسم: `Telegram Bot`
4. في حقل **Access Token** حط الـ Token اللي جاك من BotFather
5. اضغط **Save**

### 2.3 تفعيل الـ Webhook
1. افتح نود **"Webhook — طلباتي"**
2. اضغط **Listen for Test Event** عشان تاخد الرابط
3. الرابط هيكون شكله:
   ```
   https://your-n8n.com/webhook/sandwitchy
   ```
4. انسخ الرابط ده

---

## الخطوة 3 — ربط السيرفر بـ n8n

### لو بتشغّل بـ node مباشرة:
```bash
export N8N_WEBHOOK=https://your-n8n.com/webhook/sandwitchy
node server.js
```

### لو بتستخدم ملف `.env`:
أنشئ ملف `.env` في نفس مجلد المشروع:
```
N8N_WEBHOOK=https://your-n8n.com/webhook/sandwitchy
PORT=3000
```

ثم شغّل:
```bash
node server.js
```

### لو بتستخدم `start.sh`:
عدّل الملف وأضف السطر ده قبل `node server.js`:
```bash
export N8N_WEBHOOK=https://your-n8n.com/webhook/sandwitchy
```

---

## الخطوة 4 — تجربة الـ Flow

1. افتح التطبيق واكتب اسمك + يوزرنيم تيليجرامك
2. اطلب أي حاجة
3. **مهم:** كل شخص يبعت رسالة للبوت أولاً (ابعت `/start`) — ده شرط تيليجرام
4. من لوحة الأدمن اضغط **"تم تسليم الطلب"**
5. المفروض كل شخص كتب username يوصله رسالة زي دي:

```
🍽️ طلبك جاهز يا محمد!

📋 تفاصيل طلبك:
• طعمية (عيش بلدي) ×1 — 11 ج
• فول (عيش بلدي) ×1 — 10 ج

🚗 نصيبك من التوصيل: 12 ج
💰 المبلغ الكلي عليك: 33 ج

كود الجلسة: ABC123
```

---

## ⚠️ ملاحظات مهمة

- **كل شخص لازم يبعت `/start` للبوت مرة واحدة** — تيليجرام مش بيسمح للبوت يبدأ محادثة مع حد من غير ما هو يبدأ أول
- اليوزرنيم اختياري — اللي مش كاتب username هياخذه الأدمن يديله يدوياً
- الرسالة بتاتجي بالـ Markdown — لو البوت مش بيبعت، تأكد إن الشخص بعت `/start`

---

## 🔧 تخصيص الرسالة

في n8n، افتح نود **"Send Telegram Message"** وعدّل حقل **Text**:

```javascript
'🍽️ *طلبك جاهز يا ' + $json.name + '!*\n\n' +
'📋 *تفاصيل طلبك:*\n' + $json.lines_text + '\n\n' +
($json.delivery > 0 ? '🚗 *نصيبك من التوصيل:* ' + $json.delivery + ' ج\n' : '') +
'💰 *المبلغ الكلي عليك: ' + $json.total + ' ج*\n\n' +
'_كود الجلسة: ' + $json.session_id + '_'
```

### البيانات المتاحة لكل شخص (`$json`):
| الحقل | المعنى |
|-------|--------|
| `name` | اسم الشخص |
| `telegram` | يوزرنيم تيليجرام |
| `total` | المبلغ الكلي عليه |
| `items_total` | قيمة الأصناف بدون توصيل |
| `delivery` | نصيبه من التوصيل |
| `lines_text` | تفاصيل الطلب (نص جاهز) |
| `session_id` | كود الجلسة |

# 🤖 إعداد n8n + Telegram + Vercel

بما إن الموقع حالياً **Online** على Vercel، دي الخطوات النهائية عشان تربط كل حاجة ببعض.

## الخطوة 1 — إنشاء Telegram Bot

1. افتح تيليجرام وابحث عن **@BotFather**
2. ابعت `/newbot`
3. اختار اسم و username (مثلاً `sandwitchy_bot`)
4. انسخ الـ **API Token** اللي هيظهر لك.

---

## الخطوة 2 — إعداد n8n

### 2.1 Import الـ Workflow
1. افتح n8n (يفضل يكون عندك نسخة سحابية أو شغالة على VPS).
2. اضغط **New Workflow**.
3. (⋮) القائمة ← **Import from File** ← اختار `n8n-workflow.json`.

### 2.2 ربط الحسابات
1. اضغط على نود **"Send Telegram Message"**.
2. في حقل **Credential** اختار **Create New** وحط الـ Token من BotFather.
3. (اختياري) لو عايز تسجل الطلبات في **Google Sheets**:
   - فعّل نود **"Google Sheets — Log"** (شيل الـ Disable).
   - اربط حساب جوجل الخاص بك.
   - حط الـ Sheet ID في الإعدادات.

### 2.3 الحصول على رابط الـ Webhook
1. اضغط على نود **"Webhook — طلباتي"**.
2. اضغط على **Production URL** (أو Test URL للتجربة) وانسخه.
   - مثال: `https://n8n.yourdomain.com/webhook/sandwitchy`

---

## الخطوة 3 — الربط بـ Vercel

عشان الموقع "يشم" الـ n8n، لازم نحط الرابط في الـ Environment Variables:

1. افتح [Vercel Dashboard](https://vercel.com/dashboard).
2. ادخل على مشروع **sandwitchy**.
3. ادخل على **Settings** ← **Environment Variables**.
4. أضف متغير جديد:
   - **Key**: `N8N_WEBHOOK`
   - **Value**: الرابط اللي نسخته من n8n step 2.3
5. اضغط **Save**.
6. **مهم:** لازم تعمل **Redeploy** عشان التغييرات تسمع، أو ادخل على **Deployments** واعمل **Redeploy** لآخر نسخة.

---

## الخطوة 4 — تجربة التكامل

1. ادخل على موقعك: `https://sandwitchy.vercel.app/`.
2. افتح الجلسة واطلب أي حاجة (تأكد إنك كتبت الـ Telegram Username بتاعك).
3. **مهم جداً:** ابعت رسالة `/start` للبوت بتاعك في تيليجرام عشان يقدر يبعتلك.
4. من Admin Panel، اضغط **"تم تسليم الطلب"**.
5. المفروض:
   - توصلك رسالة على تيليجرام بتفاصيل حسابك.
   - (لو مفعل جوجل) يتسجل سطر جديد في الـ Google Sheet.

---

## 🔧 استكشاف الأخطاء (Troubleshooting)

- **البوت مش بيبعت؟** تأكد من الـ Token ومن إنك بعت `/start` للبوت.
- **n8n مش بيستلم حاجة؟** تأكد إن الـ URL في Vercel صح ومكتوب كامل بالـ `https://`.
- **البيانات مش بتتسجل؟** جرب تفتح الـ Live Executions في n8n وتشوف السهم واصل لحد فين.

---

## 🏗️ هيكلة البيانات (Data Schema)

البيانات اللي بتتبعت لـ n8n هي:
- `session_id`: كود الجلسة.
- `delivery`: إجمالي مبلغ التوصيل.
- `num_people`: عدد المشتركين.
- `messages`: قائمة بكل شخص (الاسم، التليجرام، الحساب، تفاصيل الأصناف).

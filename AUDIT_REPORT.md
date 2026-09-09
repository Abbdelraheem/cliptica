# تقرير التدقيق التقني المستقل الشامل — مشروع Cliptica (NOLOGY)
**تاريخ الفحص:** 9 سبتمبر 2026  
**الصفة:** مدقّق تقني مستقل (Independent Technical Auditor)  
**الحالة التشغيلية:** فحص استقصائي شامل لقراءة الكود والأنظمة الحية دون أي تعديل أو إصلاح

---

## جدول الملخص التنفيذي للملاحظات

| القسم | حرج | عالي | متوسط | منخفض | ملاحظة فقط | المجموع |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. بوابات الدفع (Stripe)** | 2 | 2 | 3 | 0 | 2 | **9** |
| **2. قاعدة البيانات** | 0 | 2 | 1 | 0 | 3 | **6** |
| **3. الفرونت إند والتصميم** | 0 | 0 | 2 | 2 | 1 | **5** |
| **4. الباك إند والـ API** | 0 | 2 | 0 | 1 | 2 | **5** |
| **5. Worker ومعالجة الفيديو** | 0 | 1 | 2 | 0 | 1 | **4** |
| **6. الأمان** | 2 | 2 | 0 | 1 | 1 | **6** |
| **7. البنية التحتية** | 0 | 3 | 0 | 0 | 1 | **4** |
| **8. الاختبارات** | 0 | 4 | 0 | 0 | 0 | **4** |
| **الإجمالي** | **4** | **16** | **8** | **4** | **11** | **43** |

---

## 1. بوابات الدفع (Stripe)

### 1.1 ثغرة استنزاف الرصيد المجاني عبر التنفيذ المتزامن للمشاريع (Race Condition / Overdraft)
- **الملف والسطر:** `src/app/api/projects/route.ts:124-136` و `worker/worker.mjs:792-811`
- **درجة الخطورة:** **حرج**
- **الدليل المباشر من الكود:**
  من `src/app/api/projects/route.ts`:
```typescript
131:     if (user.credits < minCredits) {
132:       return NextResponse.json(
133:         { error: 'Insufficient credits', required: minCredits, available: user.credits },
134:         { status: 402 }
135:       )
136:     }
```
  ومن `worker/worker.mjs`:
```javascript
792:     const creditsSpent = calcCredits(duration, fx)
793:     await prisma.$transaction(async (tx) => {
794:       const owner = await tx.user.findUnique({ where: { id: project.userId }, select: { credits: true } })
795:       const charged = Math.max(0, Math.min(creditsSpent, owner?.credits ?? 0))
796:       if (charged > 0) {
797:         await tx.user.update({ where: { id: project.userId }, data: { credits: { decrement: charged } } })
...
808:       if (charged < creditsSpent) {
809:         console.log(`[worker] ${project.id}: balance covered ${charged}/${creditsSpent} credits`)
810:       }
811:     })
```
- **التحليل:** عند إنشاء المشروع، يتحقق الـ API فقط من أن رصيد المستخدم أكبر من أو يساوي الحد الأدنى (`minCredits` = 10 افتراضياً)، لكنه **لا يخصم الرصيد ولا يحجزه (hold/reserve)**. ويتم الخصم الفعلي في الـ Worker فقط بعد اكتمال المعالجة بالكامل (`status: 'COMPLETED'`) ومحصوراً بـ `Math.min(creditsSpent, owner?.credits ?? 0)`. بالتالي، يمكن لمستخدم يملك 10 نقاط فقط إرسال 3 مشاريع متزامنة مدة كل منها 60 دقيقة (تكلفة إجمالية 180 نقطة)، وعند اكتمال المشروع الأول يُخصم 10 نقاط، بينما يكتمل المشروعان الثاني والثالث ويُخصم منهما 0 نقطة دون أي مانع تقني.

---

### 1.2 ضياع دائم للرصيد المشحون عند فقدان `userId` في Metadata الاشتراك
- **الملف والسطر:** `src/app/api/billing/webhook/route.ts:153-155`
- **درجة الخطورة:** **حرج**
- **الدليل المباشر من الكود:**
```typescript
152:   const subscription = await stripe.subscriptions.retrieve(subscriptionId)
153:   const userId = subscription.metadata?.userId
154:   if (!userId) return
```
- **التحليل:** يعتمد منح الرصيد عند تجديد الاشتراك أو سداده حصراً على استخراج `userId` من حقل `metadata` للاشتراك في Stripe. إذا تم إنشاء الاشتراك مباشرة من Stripe Dashboard، أو عبر Customer Portal، أو إذا فُقدت الـ metadata، فإن السطر 154 يُنهي التنفيذ بصمت دون إضافة أي رصيد للمستخدم. والأسوأ من ذلك، نظراً لأن الحدث قد تم تسجيله في جدول `tx.processedWebhookEvent` في بداية الـ Transaction (السطر 36)، فإن أي إعادة محاولة لاحقة من Stripe ستُعامل على أنها حدث مكرر (`duplicate: true` عبر السطر 75) ولن تُعالج أبداً، مما يتسبب في خصم الأموال من العميل وفقدان الرصيد نهائياً دون تسجيل خطأ.

---

### 1.3 استدعاء شبكي خارجي لـ Stripe API داخل Interactive Database Transaction
- **الملف والسطر:** `src/app/api/billing/webhook/route.ts:29-64` و `src/app/api/billing/webhook/route.ts:152`
- **درجة الخطورة:** **عالي**
- **الدليل المباشر من الكود:**
```typescript
29:       await prisma.$transaction(async (tx) => {
...
60:           case 'invoice.payment_succeeded': {
61:             const invoice = event.data.object as Stripe.Invoice
62:             await handleInvoicePaymentSucceeded(tx, invoice)
63:             break
64:           }
...
152:   const subscription = await stripe.subscriptions.retrieve(subscriptionId)
```
- **التحليل:** يتم تنفيذ `stripe.subscriptions.retrieve` (طلب HTTP شبكي إلى خوادم Stripe في كاليفورنيا) داخل معاملة Prisma تفاعلية (`prisma.$transaction`). هذا السلوك يعلق جلسة قاعدة البيانات وقفل السجلات طوال فترة انتظار الرد الشبكي (الذي قد يستغرق ثوانٍ في حالات الضغط أو انقطاع الاتصال)، مما يؤدي إلى استنزاف مجمع اتصالات قاعدة البيانات (Connection Pool Exhaustion) واحتمال فشل المعاملة بسبب انتهاء المهلة (Transaction Timeout).

---

### 1.4 عدم سحب ميزات الخطة فور فشل الدفع (`invoice.payment_failed`)
- **الملف والسطر:** `src/app/api/billing/webhook/route.ts:182-196`
- **درجة الخطورة:** **عالي**
- **الدليل المباشر من الكود:**
```typescript
182: async function handleInvoicePaymentFailed(tx: Tx, invoice: Stripe.Invoice) {
183:   const subscriptionId = invoice.subscription as string
184:   if (!subscriptionId) return
185: 
186:   const subscription = await stripe.subscriptions.retrieve(subscriptionId)
187:   const userId = subscription.metadata?.userId
188:   if (!userId) return
189: 
190:   await tx.user.update({
191:     where: { id: userId },
192:     data: {
193:       subscriptionStatus: 'past_due',
194:     },
195:   })
196: }
```
- **التحليل:** عند فشل سداد الفاتورة، يُحدّث الكود فقط حقل `subscriptionStatus` إلى `'past_due'`، لكنه **لا يغيّر دور المستخدم `role`**. وبما أن بوابات النظام تعتمد على `planForRole(user.role)` (السطر 120 في `projects/route.ts`)، يظل العميل المتعثر مالياً يتمتع بميزات الخطة المدفوعة بالكامل (50 أو 200 فيديو يومياً، مدة تصل إلى 180 دقيقة، جودة 1080p، وبدون علامة مائية) طالما لم يتم استقبال حدث `customer.subscription.updated` لاحقاً.

---

### 1.5 تناقض بيانات خطة Clipper بين التسويق والفوترة (300 مقابل 400 نقطة/دقيقة)
- **الملف والسطر:** `src/app/(marketing)/page.tsx:578` مقابل `src/lib/stripe.ts:43` و `src/app/(dashboard)/dashboard/billing/page.tsx:20`
- **درجة الخطورة:** **متوسط**
- **الدليل المباشر من الكود:**
  من `src/app/(marketing)/page.tsx`:
```typescript
576:   {
577:     id: 'clipper',
578:     name: 'Clipper',
579:     price: '$19',
580:     period: '/month',
581:     credits: '400 credits / month',
```
  مقابل `src/lib/stripe.ts`:
```typescript
39:   clipper: {
40:     name: 'Clipper',
41:     price: 1900, // cents
42:     priceId: process.env.STRIPE_PRICE_CLIPPER_MONTHLY,
43:     credits: 300,
```
  ومقابل `src/app/(dashboard)/dashboard/billing/page.tsx`:
```typescript
20:     credits: '300 credits / month',
```
- **التحليل:** تَعِد صفحة الهبوط التسويقية المشتركين بـ 400 نقطة شهرياً مقابل 19 دولاراً، بينما يمنح كود Stripe الفعلي ولوحة الفوترة 300 نقطة فقط. هذا تناقض تجاري وتقني مباشر يؤدي إلى شكاوى قانونية ومطالبات استرداد أموال.

---

### 1.6 ادعاء وهمي بترحيل الرصيد الشهري لمدة 30 يوماً
- **الملف والسطر:** `src/app/(marketing)/page.tsx:603` و `src/app/(dashboard)/dashboard/billing/page.tsx:70`
- **درجة الخطورة:** **متوسط**
- **الدليل المباشر من الكود:**
  من `src/app/(dashboard)/dashboard/billing/page.tsx`:
```typescript
70:           1 credit ≈ 1 minute of source footage. Unused monthly credits roll over for 30 days.
```
  ومن `src/app/(marketing)/page.tsx`:
```typescript
603:         1 credit ≈ 1 minute of source video. Unused credits roll over for 30 days.
```
- **التحليل:** لا يوجد في الكود بالكامل أي منطق لانتهاء صلاحية النقاط أو ترحيلها لمدة 30 يوماً (Roll over). حقل النقاط في جدول `User` هو مجرد رقم تزايدي `Int` لا يحتوي على تواريخ صلاحية، ويتم تجميعه إلى ما لا نهاية دون أي عملية مسح أو إعادة ضبط دورية.

---

### 1.7 غياب معالجة أحداث الاسترداد والنزاعات المالية (Refunds & Disputes)
- **الملف والسطر:** `src/app/api/billing/webhook/route.ts:40-71`
- **درجة الخطورة:** **متوسط**
- **الدليل المباشر من الكود:**
```typescript
40:         switch (event.type) {
41:           case 'checkout.session.completed': {
...
48:           case 'customer.subscription.updated': {
...
54:           case 'customer.subscription.deleted': {
...
60:           case 'invoice.payment_succeeded': {
...
66:           case 'invoice.payment_failed': {
```
- **التحليل:** قائمة الأحداث المعالجة تخلو تماماً من أحداث `charge.refunded` و `charge.dispute.created` و `customer.subscription.paused`. إذا استرد العميل أمواله عبر دعم Stripe أو أقام نزاعاً بنكياً، فإن حسابه يظل نشطاً برصيده وميزاته دون سحب أو تجميد.

---

### 1.8 تحقق سليم وإلزامي من توقيع Webhook في جميع المسارات
- **الملف والسطر:** `src/app/api/billing/webhook/route.ts:16-26`
- **درجة الخطورة:** **ملاحظة فقط** (سليم)
- **الدليل المباشر من الكود:**
```typescript
16:     const headersList = await headers()
17:     const signature = headersList.get('stripe-signature')!
...
22:       event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
23:     } catch (err) {
24:       console.error('Webhook signature verification failed:', err)
25:       return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
26:     }
```
- **التحليل:** يتم التحقق من التوقيع الرقمي للـ webhook قبل معالجة أي محتوى؛ وفي حال فشل التوقيع أو غياب الترويسة، يُرفض الطلب فوراً برمز 400.

---

### 1.9 عزل المفاتيح السرية وعدم وجود مفاتيح حية Hardcoded
- **الملف والسطر:** `src/lib/stripe.ts:3-9`
- **درجة الخطورة:** **ملاحظة فقط** (سليم)
- **الدليل المباشر من الكود:**
```typescript
3: export const stripe = new Stripe(
4:   process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
5:   {
6:     apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
7:     typescript: true,
8:   }
9: )
```
- **التحليل:** لا توجد مفاتيح إنتاجية حية مضمنة بالكود، والمفتاح الاحتياطي `sk_test_placeholder` وُضع فقط لمنع فشل عملية البناء الثابت (Next.js build).

---

## 2. قاعدة البيانات

### 2.1 غياب الفهارس (Indexes) على معرفات Stripe في جدول `User`
- **الملف والسطر:** `prisma/schema.prisma:52-55`
- **درجة الخطورة:** **عالي**
- **الدليل المباشر من الكود:**
```prisma
44: model User {
...
52:   stripeCustomerId     String?
53:   stripeSubscriptionId String?
54:   stripePriceId        String?
55:   subscriptionStatus   String?
```
- **التحليل:** الحقول `stripeCustomerId` و `stripeSubscriptionId` غير معرفة كـ `@unique` ولا تمتلك `@@index`. عند استقبال تحديثات من Stripe تتطلب البحث عن المستخدم بواسطة معرّف العميل أو معرّف الاشتراك، يضطر المحرك للقيام بمسح كامل للجدول (Full Table Scan)، مما يهدد بانهيار الأداء مع زيادة أعداد المشتركين.

---

### 2.2 غياب فهرس لحالة المشاريع `Project.status` مع وجود استعلامات تصفية متكررة
- **الملف والسطر:** `prisma/schema.prisma:154` مقابل `src/app/api/admin/projects/route.ts:31`
- **درجة الخطورة:** **متوسط**
- **الدليل المباشر من الكود:**
  في `prisma/schema.prisma`:
```prisma
154:   @@index([userId, createdAt])
```
  بينما في `src/app/api/admin/projects/route.ts`:
```typescript
31:     if (statusParam && statusParam !== 'ALL') {
32:       const s = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).safeParse(statusParam)
33:       if (s.success) where.status = s.data
34:     }
```
- **التحليل:** جدول `Project` مفهرس فقط بـ `[userId, createdAt]`. استعلامات لوحة تحكم الإدارة التي تطلب المشاريع حسب حالتها (`status`) تقوم بمسح كامل للجدول بدون فهرس داعم.

---

### 2.3 عدم تفعيل النسخ الاحتياطي التلقائي على الخادم الحي (Backup Not Scheduled)
- **الملف والسطر:** `deploy/backup.sh` مقابل الأوامر المنفذة على الخادم الحي `13.62.192.145`
- **درجة الخطورة:** **عالي**
- **الدليل المباشر من الأمر المنفذ:**
```text
ubuntu@13.62.192.145:
$ sudo crontab -l
no crontab for root
$ crontab -l
no crontab for ubuntu
$ systemctl list-timers
(لا يوجد أي مؤقت خاص بـ backup.sh)
```
- **التحليل:** بالرغم من وجود ملف السكريبت `deploy/backup.sh` في المستودع، إلا أنه **غير مجدول نهائياً** عبر cron أو systemd timer على السيرفر الحي. قاعدة بيانات Neon السحابية توفر استعادة نقطية (PITR) من طرفها، لكن النسخ المحلي أو الإرسال الخارجي التلقائي غير مفعل إطلاقاً على السيرفر.

---

### 2.4 سلامة أنواع الحقول المالية لمنع أخطاء التقريب
- **الملف والسطر:** `prisma/schema.prisma:51`, `214-217`, `251`, `283`
- **درجة الخطورة:** **ملاحظة فقط** (سليم)
- **الدليل المباشر من الكود:**
```prisma
51:   credits              Int       @default(40)
...
214:   ratePer1k Decimal      @db.Decimal(10, 2)
215:   flatFee   Decimal?     @db.Decimal(10, 2)
216:   budget    Decimal?     @db.Decimal(10, 2)
217:   spent     Decimal      @default(0) @db.Decimal(10, 2)
...
251:   amount      Decimal      @db.Decimal(10, 2)
...
283:   amount      Int // positive = added, negative = spent
```
- **التحليل:** جميع الحقول المالية مصممة بطريقة سليمة جداً: النقاط كـ `Int` والمبالغ المالية بالدولار كـ `Decimal(10, 2)`. لا يوجد أي استخدام للنوع `Float` العرضة لمشاكل التقريب العشري في الحسابات المالية.

---

### 2.5 اكتمال سياسات الحذف `onDelete` في جميع علاقات النماذج
- **الملف والسطر:** `prisma/schema.prisma:78, 102, 112, 130, 150, 168, 199, 200, 223, 240, 241, 260, 261, 262, 275, 289, 313, 326`
- **درجة الخطورة:** **ملاحظة فقط** (سليم)
- **الدليل المباشر من الكود:**
  جميع العلاقات البينية في `schema.prisma` تحدد صراحة إما `onDelete: Cascade` (لحذف التبعيات التابعة مثل المقاطع والوظائف والجلسات عند حذف المستخدم أو المشروع) أو `onDelete: SetNull` (في جدول `Payout` لربطه بالحملة أو المقطع دون إتلاف السجل المالي التاريخي عند حذف المقطع).

---

### 2.6 استعلام القراءة الحصري لبيانات الجداول الحية وحالات التعليق
- **الملف والسطر:** استعلام مباشر عبر Prisma Client على خادم الإنتاج
- **درجة الخطورة:** **ملاحظة فقط** (إحصائي)
- **الدليل المباشر من مخرجات السيرفر:**
```json
---DB_COUNTS_START---
{
  "users": 5,
  "devices": 1,
  "projects": 6,
  "processingJobs": 10,
  "clips": 5,
  "campaigns": 0,
  "campaignClips": 0,
  "payouts": 0,
  "creditTransactions": 4,
  "processedWebhookEvents": 0
}
---DB_COUNTS_END---
---STUCK_PROJECTS_24H_START---
[]
---STUCK_JOBS_24H_START---
[]
```
- **التحليل:** لا توجد أي صفوف عالقة في حالة `PROCESSING` أو `queued` لأكثر من 24 ساعة في قاعدة البيانات الفعلية.

---

## 3. الفرونت إند والتصميم

### 3.1 فشل تباين الألوان معايير إمكانية الوصول WCAG AA للنصوص الثانوية (`text-mist-2`)
- **الملف والسطر:** `src/app/globals.css:19`
- **درجة الخطورة:** **متوسط**
- **الدليل المباشر من الكود:**
```css
11:   --onyx: #050505;
...
19:   --mist-2: rgba(255, 255, 255, 0.38);
```
- **التحليل:** لون النصوص الثانوية `--mist-2` ينتج عنه لون فعلي `#616161` فوق الخلفية الداكنة `#050505`. نسبة التباين المحسوبة علمياً هي **3.3:1**، وهي أقل من الحد الأدنى الملزم لمعيار WCAG AA للنصوص العادية البالغ **4.5:1**. هذا الفشل يظهر في عشرات المواضع، منها:
  - `src/app/(auth)/login/page.tsx:136`: رابط استعادة كلمة المرور
  - `src/app/(dashboard)/dashboard/billing/page.tsx:70`: نص سياسة الرصيد
  - `src/app/(admin)/admin/users/page.tsx:226`: نصوص حالة الاشتراكات

---

### 3.2 غياب مؤشرات التركيز عبر لوحة المفاتيح في أزرار `.btn-lux`
- **الملف والسطر:** `src/app/globals.css:165-179`
- **درجة الخطورة:** **متوسط**
- **الدليل المباشر من الكود:**
```css
165: .btn-lux {
166:   display: inline-flex;
167:   align-items: center;
168:   justify-content: center;
169:   gap: 8px;
170:   cursor: pointer;
171:   border: none;
172:   border-radius: 999px;
173:   font-family: var(--font-body);
174:   font-size: 0.95rem;
175:   font-weight: 500;
176:   padding: 13px 28px;
177:   transition: all 0.3s var(--ease-lux);
178:   white-space: nowrap;
179: }
```
- **التحليل:** الفئة الرئيسية المستخدمة لأزرار النظام بالكامل (`.btn-lux` في صفحات التسجيل والدخول والفوترة وصفحة الهبوط) تفتقر تماماً لقواعد `:focus` و `:focus-visible`. عندما يتنقل المستخدم الكفيف أو مستخدم لوحة المفاتيح عبر زر `Tab`، لا يظهر أي إطار تركيز بصري على الزر، مما يعيق التنقل الموجه ويفشل معيار WCAG 2.4.7 (Focus Visible). في المقابل، مكونات `button.tsx` المنفصلة تستخدم حلقة تركيز مخصصة، مما يخلق تفاوتاً بصرياً حاداً.

---

### 3.3 استخدام وسوم صور HTML خام وغير محسنة بدلاً من `next/image`
- **الملف والسطر:** `src/app/(dashboard)/dashboard/projects/detail/project-detail.tsx:180`
- **درجة الخطورة:** **منخفض**
- **الدليل المباشر من الكود:**
```tsx
180: <img src={c.thumbnailUrl} alt={c.title} className="h-full w-full object-cover opacity-70" />
```
- **التحليل:** لا يتم استيراد أو استخدام مكون `next/image` في أي ملف داخل مجلد `src/`. في صفحة تفاصيل المشروع، تُعرض الصور المصغرة عبر وسم `<img>` عادي دون تحسين تلقائي للحجم أو صيغ WebP/AVIF التكيفية أو التحميل الكسول المدمج.

---

### 3.4 غياب سمات إمكانية الوصول الديناميكية `role="alert"` في نماذج الدخول والتسجيل
- **الملف والسطر:** `src/app/(auth)/login/page.tsx:125-130` و `src/app/(auth)/register/page.tsx:131-136`
- **درجة الخطورة:** **منخفض**
- **الدليل المباشر من الكود:**
```tsx
125:             {error && (
126:               <p className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-300">
127:                 <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
128:                 {error}
129:               </p>
130:             )}
```
- **التحليل:** عند حدوث خطأ في تسجيل الدخول أو إدخال بيانات غير صحيحة، يظهر الخطأ كعنصر فقرة عادي `<p>` دون إضافة `role="alert"` أو `aria-live="polite"`. قارئات الشاشة للمكفوفين لن تعلن عن وجود الخطأ تلقائياً عند ظهوره.

---

### 3.5 نقاء النصوص الإنجليزية وانعدام الخلط اللغوي العشوائي
- **الملف والسطر:** مسح شامل لجميع ملفات `src/**/*.{ts,tsx}`
- **درجة الخطورة:** **ملاحظة فقط** (سليم)
- **الدليل المباشر من الكود:**
  السطر الوحيد الذي يحتوي على أحرف عربية في كامل واجهة التطبيق هو:
  `src/app/(dashboard)/dashboard/projects/new/page.tsx:23`:
```typescript
['en', 'English'], ['ar', 'العربية (Arabic)'], ['es', 'Spanish']
```
- **التحليل:** الواجهة مصممة بالكامل باللغة الإنجليزية وبشكل متسق، ولا يوجد أي خلط لغوي ناتج عن نسخ ولصق غير مقصود.

---

## 4. الباك إند والـ API

### 4.1 جدول حصر وتقييم جميع مسارات الـ API (32 مساراً)

| المسار (Route) | الـ Method | التحقق من الهوية (Auth) | فحص الملكية (Ownership) | التحقق بـ Zod | تحديد المعدل (Rate Limit) | رموز الحالة المرجعة (Status Codes) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `admin/jobs/[id]/retry` | POST | نعم (Admin) | غير منطبق | لا | لا | 200, 403, 404, 500 |
| `admin/motion-fx` | GET, PATCH | نعم (Admin) | غير منطبق | نعم | لا | 200, 400, 401, 403, 500 |
| `admin/payments` | GET | نعم (Admin) | غير منطبق | نعم | لا | 200, 403, 500 |
| `admin/payouts` | GET | نعم (Admin) | غير منطبق | نعم | لا | 200, 403, 500 |
| `admin/payouts/[id]` | PATCH | نعم (Admin) | غير منطبق | نعم | لا | 200, 400, 403, 404, 500 |
| `admin/projects` | GET | نعم (Admin) | غير منطبق | نعم | لا | 200, 403, 500 |
| `admin/projects/[id]` | GET | نعم (Admin) | غير منطبق | نعم | لا | 200, 403, 404, 500 |
| `admin/projects/[id]/retry` | POST | نعم (Admin) | غير منطبق | لا | لا | 200, 403, 404, 500 |
| `admin/settings` | GET, PATCH | نعم (Admin) | غير منطبق | نعم | لا | 200, 400, 403, 500 |
| `admin/stats` | GET | نعم (Admin) | غير منطبق | لا | لا | 200, 403, 500 |
| `admin/users` | GET | نعم (Admin) | غير منطبق | نعم | لا | 200, 403, 500 |
| `admin/users/[id]` | GET | نعم (Admin) | غير منطبق | لا | لا | 200, 403, 404, 500 |
| `admin/users/[id]/credits` | POST | نعم (Admin) | غير منطبق | نعم | لا | 200, 400, 403, 404, 500 |
| `admin/users/[id]/role` | PATCH | نعم (Admin) | غير منطبق | نعم | لا | 200, 400, 403, 500 |
| `auth/[...nextauth]` | ALL | عبر NextAuth | مدمج | لا | لا | 200, 302 |
| `auth/forgot-password` | POST | لا (عام) | نعم (بالبريد) | نعم | **معطل** (مكتوب فقط) | 200, 400, 500 |
| `auth/me` | GET, PATCH | نعم (User) | نعم | نعم | لا | 200, 400, 401, 404, 500 |
| `auth/register` | POST | لا (عام) | غير منطبق | نعم | **معطل** (مكتوب فقط) | 200, 400, 403, 409, 500 |
| `auth/resend-verification` | POST | لا (عام) | نعم (بالبريد) | نعم | **معطل** (مكتوب فقط) | 200, 400, 500 |
| `auth/reset-password` | POST | لا (عام) | نعم (بالرمز) | نعم | **معطل** (مكتوب فقط) | 200, 400, 500 |
| `auth/verification-status` | POST | لا (عام) | لا | نعم | **معطل** (مكتوب فقط) | 200 |
| `auth/verify-email` | POST | لا (عام) | نعم (بالرمز) | نعم | لا | 200, 400, 500 |
| `billing/checkout` | GET | نعم (User) | نعم | لا | لا | 303 (Redirect) |
| `billing/portal` | GET | نعم (User) | نعم | لا | لا | 303 (Redirect) |
| `billing/webhook` | POST | Stripe Signature | نعم | لا | لا | 200, 400, 500 |
| `campaigns` | GET, POST | نعم (User) | نعم | نعم | **معطل** (مكتوب فقط) | 200, 400, 401, 500 |
| `device/check` | POST | نعم (User) | لا | نعم | لا | 200, 400, 401, 403, 500 |
| `health` | GET | لا (عام) | لا | لا | لا | 200 |
| `payouts` | GET, POST | نعم (User) | نعم | نعم | **معطل** (مكتوب فقط) | 200, 400, 401, 404, 500 |
| `projects` | GET, POST | نعم (User) | نعم | نعم | **معطل** (مكتوب فقط) | 200, 201, 400, 401, 402, 429, 500 |
| `projects/[id]` | GET | نعم (User) | نعم | لا | لا | 200, 401, 404, 500 |
| `projects/upload-url` | POST | نعم (User) | لا | نعم | لا | 200, 400, 401, 413, 500 |

---

### 4.2 تعطيل الـ Rate Limiting عملياً في بيئة الإنتاج لغياب بيانات Upstash
- **الملف والسطر:** `src/lib/rate-limit.ts:25-32` و `.env:1-35`
- **درجة الخطورة:** **عالي**
- **الدليل المباشر من الكود:**
```typescript
25: export async function enforceRateLimit(
26:   limiter: Ratelimit | null,
27:   identifier: string
28: ): Promise<NextResponse | null> {
29:   if (!limiter) return null
```
  وفي `AGENT_LOG.md:70`:
  > "Rate limiting is currently a NO-OP: all limiter instances are null without UPSTASH_REDIS_REST_URL/TOKEN."
- **التحليل:** في غياب متغيرات البيئة لـ Upstash Redis في السيرفر الحي، تصبح قيمة جميع محددات السرعة `null`، والدالة ترجع `null` على الفور. هذا يترك مسارات حساسة جداً مثل تسجيل الدخول، والتسجيل الجديد، وطلبات إنشاء المشاريع، واستعادة كلمة المرور بدون أي حماية ضد هجمات القوة الغاشمة (Brute-Force) أو الإغراق (DDoS).

---

### 4.3 إمكانية تجاوز حد حجم الرفع المسموح به إلى Cloudflare R2
- **الملف والسطر:** `src/app/api/projects/upload-url/route.ts:35-43` و `src/lib/r2.ts:58-62`
- **درجة الخطورة:** **عالي**
- **الدليل المباشر من الكود:**
  من `src/app/api/projects/upload-url/route.ts`:
```typescript
35:     if (parsed.data.sizeMb > maxMb) {
36:       return NextResponse.json({ error: `File exceeds ${maxMb}MB limit` }, { status: 413 })
37:     }
...
41:     const uploadUrl = r2PresignPut(key, parsed.data.contentType)
```
  ومن `src/lib/r2.ts`:
```typescript
58:   if (method === 'PUT' && opts.contentType) {
59:     signedHeaders = 'content-type;host'
60:     canonicalHeaders = `content-type:${opts.contentType}\nhost:${host}\n`
61:   }
```
- **التحليل:** يتحقق الـ API من حجم الملف استناداً فقط إلى الرقم الذي يرسله العميل في جسم الطلب `sizeMb`. لكن عند إنشاء رابط الرفع الموقع (SigV4 Presigned PUT URL)، **لا يتم تضمين قيد الحجم `content-length-range` في التوقيع الرقمي**. يستطيع أي مستخدم إرسال `sizeMb: 5` للحصول على الرابط الموقع، ثم استخدام الرابط لرفع ملف فيديو بحجم 10 جيجابايت مباشرة إلى حاوية R2، مما يتسبب في استهلاك سعة التخزين وتكاليف باهظة دون رقابة.

---

### 4.4 عدم توحيد هيكل الاستجابة عبر مسارات الـ API (Inconsistent Envelopes)
- **الملف والسطر:** مقارنة بين `src/app/api/auth/register/route.ts:74` و `src/app/api/projects/route.ts:74` و `src/app/api/payouts/route.ts:56`
- **درجة الخطورة:** **منخفض**
- **الدليل المباشر من الكود:**
  - في التسجيل: `return NextResponse.json({ id: user.id, email: user.email, name: user.name, message: '...' })`
  - في المشاريع: `return NextResponse.json({ projects })`
  - في المدفوعات: `return NextResponse.json({ payouts, pagination: { page, limit, total, totalPages } })`
  - في الأخطاء: تارة `{ error: string }` وتارة `{ error: 'DEVICE_LIMIT', message: string }` وتارة `{ error: 'Invalid input', details: object }`.
- **التحليل:** لا يوجد غلاف موحد (Unified Response Envelope مثل `{ data, error, meta }`)، مما يعقد معالجة الأخطاء والبيانات في واجهات المستخدم وتطبيقات الطرف الثالث.

---

### 4.5 سلامة المسارات من تسريب تفاصيل الأخطاء والـ Stack Traces
- **الملف والسطر:** مسح لجميع كتل `catch` في الـ 32 route
- **درجة الخطورة:** **ملاحظة فقط** (سليم)
- **الدليل المباشر من الكود:**
  جميع مسارات الـ API بدون استثناء تقوم بالتقاط الأخطاء وتسجيلها داخلياً عبر `console.error`، بينما تعيد للمستخدم رسائل عامة وآمنة مثل `{ error: 'Failed to create project' }`، دون تسريب أي تفاصيل حول بنية السيرفر أو مسارات الملفات.

---

## 5. Worker ومعالجة الفيديو

### 5.1 مخاطر استهلاك السعة التخزينية بسبب تنزيل مقاطع يوتيوب الطويلة قبل التحقق
- **الملف والسطر:** `worker/worker.mjs:690-697` و `worker/worker.mjs:713-724`
- **درجة الخطورة:** **عالي**
- **الدليل المباشر من الكود:**
```javascript
690:   const preDur = await probeUrlDuration(project.sourceUrl)
691:   if (!preDur) return
...
713:     const src = project.sourceFile
714:       ? await downloadFromR2(project.sourceFile, dir)
715:       : (await ensureWithinPlan(project), await download(project.sourceUrl, dir))
716: 
717:     const duration = await probeDuration(src)
718:     const owner = await prisma.user.findUnique({ where: { id: project.userId }, select: { role: true } })
719:     const maxMin = planMaxMinutes(owner?.role)
720:     if (exceedsPlanMinutes(duration / 60, owner?.role)) {
721:       throw new Error(
722:         `Source is ${Math.round(duration / 60)} min — exceeds the ${maxMin} min limit for the ${owner?.role ?? 'FREE'} plan`
```
- **التحليل:** في السطر 691، إذا فشل استعلام بيانات المقطع المسبق (`probeUrlDuration`) لأي سبب (مثل بث مباشر، أو حجب يوتيوب لبيانات الميتا)، تعود الدالة دون خطأ (`return`)، وينتقل الـ Worker مباشرة إلى السطر 715 لتنزيل المقطع بالكامل عبر `download()`. إذا كان المقطع مدته 10 ساعات، فسيقوم السيرفر بتنزيل عشرات الجيجابايت على القرص، وفقط بعد اكتمال التنزيل يفحص المدة ويرفض المشروع، مما قد يملأ القرص (المتبقي منه 28 جيجابايت فقط) ويؤدي إلى توقف الخادم بالكامل.

---

### 5.2 تراكم ملفات مؤقتة وفيديوهات وسجلات مهملة في `/tmp` على السيرفر الحي
- **الملف والسطر:** المجلد `/tmp` على خادم الإنتاج
- **درجة الخطورة:** **متوسط**
- **الدليل المباشر من نتيجة فحص الخادم الحي:**
```text
$ sudo du -sh /tmp/*
9.3M  /tmp/finalclip.mp4
7.0M  /tmp/optest
4.2M  /tmp/sintel-test
3.2M  /tmp/e2e-source.wav
1.2M  /tmp/e2e-source.mp4
1.2M  /tmp/r2src.mp4
968K  /tmp/t_Big_Buck_Bunny_360_10s_1MB.mp4
800K  /tmp/dl-clip-2.mp4
296K  /tmp/dl-clip-1.mp4
972K  /tmp/test-probe
(بالإضافة إلى أكثر من 40 سكريبت شل وبايثون ومخرجات تشغيل يدوية)
```
- **التحليل:** بالرغم من أن قاعدة البيانات لا تحتوي سوى على 6 مشاريع، إلا أن المجلد المؤقت `/tmp` يحتوي على ملفات فيديو ورندرة واختبارات يدوية متروكة من جولات التطوير دون مسح.

---

### 5.3 غياب آلية تنظيف للمجلدات المؤقتة اليتيمة عند انهيار العملية المفاجئ
- **الملف والسطر:** `worker/worker.mjs:707-815`
- **درجة الخطورة:** **متوسط**
- **الدليل المباشر من الكود:**
```javascript
707:   const dir = await mkdtemp(path.join(tmpdir(), 'nology-'))
708:   try {
...
814:   } finally {
815:     await rm(dir, { recursive: true, force: true }).catch(() => {})
816:   }
```
- **التحليل:** يعتمد تنظيف المجلد المؤقت للمشروع حصراً على تنفيذ كتلة `finally`. إذا تعرضت العملية للقتل القسري عبر نظام التشغيل (Out-Of-Memory Killer) أو أمر `kill -9` أو إعادة تشغيل PM2 أثناء المعالجة، فلن تُنفذ كتلة `finally`، وستبقى مجلدات `nology-*` في `/tmp` إلى الأبد لعدم وجود مهمة تنظيف دورية تفحص المجلدات اليتيمة.

---

### 5.4 نظام تعافي دوري فعال للمهام العالقة (Stale Jobs Recovery)
- **الملف والسطر:** `worker/worker.mjs:820-830` و `worker/worker.mjs:871-874`
- **درجة الخطورة:** **ملاحظة فقط** (سليم)
- **الدليل المباشر من الكود:**
```javascript
820: async function recoverStale() {
821:   try {
822:     const staleBefore = new Date(Date.now() - (await cfg()).stale_job_minutes * 60_000)
823:     const revived = await prisma.processingJob.updateMany({
824:       where: { status: 'processing', startedAt: { lt: staleBefore } },
825:       data: { status: 'queued', startedAt: null },
826:     })
...
871:     if (Date.now() - lastSweep >= 5 * 60_000) {
872:       lastSweep = Date.now()
873:       await recoverStale()
874:     }
```
- **التحليل:** يمتلك الـ Worker آلية دورية ذكية تنفذ كل 5 دقائق للبحث عن المهام التي علقت في حالة `processing` لفترة تتجاوز `stale_job_minutes` وإعادتها إلى قائمة الانتظار تلقائياً.

---

## 6. الأمان

### 6.1 ثغرات أمنية حرجة تسمح بتنفيذ الأوامر عن بُعد دون مصادقة (Next.js Critical RCE)
- **الملف والسطر:** `package.json:43` (Next.js version 15.5.23)
- **درجة الخطورة:** **حرج**
- **الدليل المباشر من مخرجات `npm audit`:**
```text
next  9.3.4-canary.0 - 16.3.0-preview.10
Severity: critical
Next.js: Unauthenticated Remote Code Execution on windows-hosted servers - https://github.com/advisories/GHSA-p293-qw3h-jr36
Next.js: Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used - https://github.com/advisories/GHSA-2xp9-vwfh-vxw4
Depends on vulnerable versions of postcss
Depends on vulnerable versions of sharp
fix available via `npm audit fix --force`
Will install next@15.5.25, which is outside the stated dependency range
node_modules/next
```
- **التحليل:** النسخة الحالية من Next.js تحتوي على ثغرتين RCE حرجتين تسمحان للمهاجمين بتنفيذ تعليمات برمجية عشوائية عن بعد دون مصادقة (إحداهما خاصة بالخوادم المستضافة على ويندوز، والأخرى خاصة بواجهة تحسين الصور عند التعامل مع ملفات AVIF).

---

### 6.2 ثغرات أمنية عالية الخطورة في الحزم التابعة (sharp, postcss, deepmerge-ts, js-yaml)
- **الملف والسطر:** `package-lock.json`
- **درجة الخطورة:** **عالي**
- **الدليل المباشر من مخرجات `npm audit`:**
```text
sharp  <=0.35.4-rc.0
Severity: high
sharp inherited vulnerabilities in libvips: CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 - https://github.com/advisories/GHSA-f88m-g3jw-g9cj
sharp: Vulnerabilities in libheif: GHSA-g89c-p67h-r497 and GHSA-2jg2-4ch7-h545

postcss  <=8.5.22
Severity: high
PostCSS has XSS via Unescaped </style> in its CSS Stringify Output - https://github.com/advisories/GHSA-qx2v-qp2m-jg93
PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments - https://github.com/advisories/GHSA-6g55-p6wh-862q
PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure - https://github.com/advisories/GHSA-r28c-9q8g-f849

deepmerge-ts  <8.0.0
Severity: high
DeepmergeTS has stack exhaustion when merging recursive object graphs - https://github.com/advisories/GHSA-ggr8-5vv4-36mx

js-yaml  4.0.0 - 4.3.1
Severity: high
js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources - https://github.com/advisories/GHSA-2883-xcg3-v3hh
```
- **التحليل:** وجود 6 ثغرات بمستوى خطورة عالي تهدد بتسريب الملفات واختراق الذاكرة وإجهاد المعالج (ReDoS/CPU Exhaustion).

---

### 6.3 تشغيل التطبيق مباشرة على المنفذ 3000 وتعريضه للإنترنت العام دون TLS
- **الملف والسطر:** خادم الإنتاج `13.62.192.145:3000`
- **درجة الخطورة:** **حرج**
- **الدليل المباشر من أمر الفحص الحي:**
```text
$ curl.exe -I http://13.62.192.145:3000/
HTTP/1.1 200 OK
...
$ curl.exe -I http://13.62.192.145/
curl: (7) Failed to connect to 13.62.192.145:80 after 5032 ms: Could not connect to server
```
- **التحليل:** تطبيق Next.js معرّض للإنترنت العام مباشرة عبر المنفذ `3000` ببروتوكول HTTP العادي دون تشفير TLS/SSL ودون وسيط عكسي (Reverse Proxy كـ Nginx أو Caddy). المنافذ القياسية 80 و 443 مغلقة تماماً. أي بيانات حساسة، بما فيها كلمات المرور وتوكنات المصادقة وجلسات المستخدمين، تنتقل كنص واضح غير مشفر (Cleartext).

---

### 6.4 غياب ترويسات الأمان الصارمة HSTS و Content-Security-Policy
- **الملف والسطر:** `next.config.ts:51-60` ومخرجات الترويسات الحية من `13.62.192.145:3000`
- **درجة الخطورة:** **عالي**
- **الدليل المباشر من الكود واستجابة الخادم الحي:**
  الترويسات المطبقة فعلياً في السيرفر الحي:
```http
HTTP/1.1 200 OK
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```
- **التحليل:** الترويسات المعرفة في `next.config.ts` مطبقة بالفعل، ولكن ترويسة `Strict-Transport-Security` (HSTS) وترويسة `Content-Security-Policy` (CSP) **غائبتان تماماً**. كان من المفترض أن يوفرهما Nginx وفق ملف `deploy/nginx/nology.conf`، ولكن Nginx غير مشغل على الخادم.

---

### 6.5 تسريب ترويسة تقنية النظام `X-Powered-By: Next.js`
- **الملف والسطر:** `next.config.ts:7-67` ومخرجات `curl -I`
- **درجة الخطورة:** **منخفض**
- **الدليل المباشر من الرد الحي:**
```http
X-Powered-By: Next.js
```
- **التحليل:** ملف `next.config.ts` لم يقم بتعطيل ترويسة التقنية عبر `poweredByHeader: false`، مما يعلن صراحة للمهاجمين وماسحات الثغرات عن نوع وإصدار إطار العمل المستخدم لتسهيل استهدافه.

---

### 6.6 سلامة تاريخ Git من تسريب أي ملفات بيئة حقيقية
- **الملف والسطر:** فحص تاريخ Git عبر السجل الكامل
- **درجة الخطورة:** **ملاحظة فقط** (سليم)
- **الدليل المباشر من الأمر المنفذ:**
```text
$ git log --all --full-history --name-only --format="" -- "*.env*" | Sort-Object -Unique
.env.example
```
- **التحليل:** لم يتم تسريب أي ملف بيئة حقيقي (`.env` أو `.env.local` أو `.env.production`) في تاريخ الـ Git، والملف الوحيد المؤرشف هو ملف النماذج التجريبية `.env.example`.

---

## 7. البنية التحتية

### 7.1 تشغيل جميع عمليات التطبيق بصلاحيات المستخدم الجذري الكاملة (`root`)
- **الملف والسطر:** خادم الإنتاج `13.62.192.145`
- **درجة الخطورة:** **عالي**
- **الدليل المباشر من مخرجات الأمر `sudo pm2 status`:**
```text
┌────┬──────────────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┐
│ id │ name             │ version │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │
├────┼──────────────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┤
│ 3  │ nology-bot       │ 0.1.0   │ 34848    │ 3D     │ 3    │ online    │ 0%       │ 85.9mb   │ root     │
│ 1  │ nology-web       │ 15.5.23 │ 358457   │ 24h    │ 14   │ online    │ 0%       │ 249.6mb  │ root     │
│ 4  │ nology-worker    │ 1.0.0   │ 119148   │ 47h    │ 10   │ online    │ 0%       │ 91.3mb   │ root     │
│ 0  │ pm2-logrotate    │ 3.0.0   │ 10712    │ 4D     │ 4    │ online    │ 0%       │ 66.8mb   │ root     │
└────┴──────────────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┘
```
- **التحليل:** تعمل كل من واجهة الويب (`nology-web`) ومعالج الفيديو (`nology-worker`) وبوت التيليجرام (`nology-bot`) تحت المستخدم `root`. في حال حدوث اختراق عبر ثغرة Next.js RCE المذكورة في البند 6.1، فإن المهاجم سيحصل فوراً على صلاحيات جذرية كاملة (Root Access) على الخادم بأكمله.

---

### 7.2 انعدام تام لأي نظام مراقبة خارجي أو رصد لوقت التشغيل (Uptime Monitoring)
- **الملف والسطر:** خدمات النظام على خادم الإنتاج
- **درجة الخطورة:** **عالي**
- **الدليل المباشر من نتيجة الأوامر الحية:**
```text
$ sudo systemctl status prometheus
Unit prometheus.service could not be found.
$ sudo systemctl status node_exporter
Unit node_exporter.service could not be found.
```
- **التحليل:** على الرغم من وجود سكريبت `deploy/monitoring-setup.sh` في المستودع، إلا أنه لم يتم تشغيله؛ فلا يوجد خادم Prometheus أو Node Exporter، كما لا توجد أي خدمة مراقبة خارجية (مثل UptimeRobot أو BetterStack) تقوم بالتحقق من مسار `/api/health`. إذا توقف التطبيق أو انهار الـ Worker، فلن يتلقى الفريق أي إشعار.

---

### 7.3 تعطل النطاق الرسمي وعدم تفعيل خادم الويب العكسي وشهادة SSL
- **الملف والسطر:** `deploy/DNS-REQUIREMENTS.md` مقابل السيرفر الحي
- **درجة الخطورة:** **عالي**
- **الدليل المباشر من نتيجة الفحص:**
```text
$ curl.exe -I https://app.getnology.com/
curl: (6) Could not resolve host: app.getnology.com
$ curl.exe -I http://13.62.192.145:80/
curl: (7) Failed to connect to 13.62.192.145:80: Could not connect to server
```
- **التحليل:** النطاق `app.getnology.com` غير مرتبط بالخادم عبر الـ DNS، وخادم Nginx غير مشغل نهائياً، وشهادات Let's Encrypt غير منشأة، مما يجعل النظام غير قابل للوصول التجاري الآمن.

---

### 7.4 قياس استهلاك الموارد الحالية وحالة السيرفر الحي
- **الملف والسطر:** مخرجات النظام الحية من السيرفر `13.62.192.145`
- **درجة الخطورة:** **ملاحظة فقط** (إحصائي)
- **الدليل المباشر من الأوامر الحية:**
  - **الذاكرة والمعالج:** CPU 1.8%، واستهلاك الذاكرة 12.6% (~1 جيجابايت من أصل 7.6 جيجابايت).
  - **مساحة القرص (`df -h`):**
```text
Filesystem       Size  Used Avail Use% Mounted on
/dev/root         38G   11G   28G  28% /
/dev/nvme0n1p16  881M  202M  617M  25% /boot
```
  - **مسار الصحة (`/api/health`):**
```json
{
  "status": "healthy",
  "uptime": 86659,
  "checks": {
    "database": { "status": "healthy", "latency_ms": 1003 },
    "storage": { "status": "healthy" },
    "payments": { "status": "not_configured" },
    "ai": { "status": "not_configured" }
  }
}
```
- **التحليل:** الموارد الفيزيائية الحالية مستقرة مع وجود 28 جيجابايت مساحة حرة، ولكن مسار الصحة يوضح أن بوابات الدفع والذكاء الاصطناعي معلّمة بـ `not_configured` على هذا الخادم.

---

## 8. الاختبارات

### 8.1 فشل اختبارات التحقق من التكرار لحركات الدفع (`tests/webhook-idempotency.test.ts`)
- **الملف والسطر:** `tests/webhook-idempotency.test.ts:107` و `tests/webhook-idempotency.test.ts:120`
- **درجة الخطورة:** **عالي**
- **الدليل المباشر من أمر التشغيل الفعلي `npx vitest run`:**
```text
 RUN  v4.1.11 C:/Users/Dr.Abdelraheem/Desktop/cliptica

 ❯ tests/webhook-idempotency.test.ts (5 tests | 2 failed) 27ms
     × records the event BEFORE processing so concurrent retries lose the race 3ms
     × processes a fresh event exactly once on success 1ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/webhook-idempotency.test.ts > Stripe webhook idempotency (atomic insert-first transaction) > records the event BEFORE processing so concurrent retries lose the race
TypeError: expected value must be number or bigint, received "undefined"
 ❯ tests/webhook-idempotency.test.ts:107:48
    106|     expect(create.mock.invocationCallOrder[0]).toBeLessThan(userUpdate.mock.invocationCallOrder[0])
    107|     expect(create.mock.invocationCallOrder[0]).toBeLessThan(
       |                                                ^
    108|       creditTransactionCreate.mock.invocationCallOrder[0]
    109|     )

 FAIL  tests/webhook-idempotency.test.ts > Stripe webhook idempotency (atomic insert-first transaction) > processes a fresh event exactly once on success
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
 ❯ tests/webhook-idempotency.test.ts:120:37
    119|     expect(userUpdate).toHaveBeenCalledTimes(1)
    120|     expect(creditTransactionCreate).toHaveBeenCalledTimes(1)
       |                                     ^
    121|   })

 Test Files  1 failed | 5 passed (6)
      Tests  2 failed | 57 passed (59)
```
- **التحليل:** عند إجراء التعديل الأخير في الكوميت `cb5e4ad` لمنع منح الرصيد مرتين عند اشتراك العميل، تم حذف استدعاء `tx.creditTransaction.create` من دالة `handleCheckoutCompleted`، ولكن لم يتم تحديث الاختبار ليطابق السلوك الجديد، مما ترك بيئة الاختبارات معطوبة (2 اختبارات فاشلة رسمياً).

---

### 8.2 انعدام تام لاختبارات مسارات المصادقة والتسجيل والصلاحيات (Auth Zero Coverage)
- **الملف والسطر:** مجلد `tests/`
- **درجة الخطورة:** **عالي**
- **الدليل المباشر:**
  قائمة ملفات الاختبار الموجودة فعلياً في المستودع:
```text
tests/clip-from.test.ts
tests/credits.test.mjs
tests/device.test.ts
tests/ssrf.test.mjs
tests/validation.test.ts
tests/webhook-idempotency.test.ts
```
- **التحليل:** لا يوجد أي اختبار وحدة أو تكامل لمسارات المصادقة الحساسة:
  - `src/lib/auth.ts` (تسجيل الدخول، التحقق من كلمات المرور المشفرة عبر bcrypt، إنشاء جلسات JWT)
  - `src/app/api/auth/register/route.ts` (تسجيل المستخدمين وربط الأجهزة)
  - `src/app/api/auth/verify-email/route.ts` و `reset-password/route.ts`
  - التحقق من صلاحيات المدير (`getAdminSession`).

---

### 8.3 غياب الاختبارات لخط معالجة الفيديو في الـ Worker بالكامل (Pipeline Zero Coverage)
- **الملف والسطر:** `worker/worker.mjs` ومجلد `tests/`
- **درجة الخطورة:** **عالي**
- **الدليل المباشر:** مجلد `tests/` لا يحتوي سوى على اختبار دوال الحسابات الرياضية `credits.test.mjs` واختبار فحص العناوين الداخلية `ssrf.test.mjs`.
- **التحليل:** أكثر من 850 سطراً في `worker/worker.mjs` المسؤولة عن تنزيل اليوتيوب، والتفريغ الصوتي الذكي، وتقييم الفيديوهات بالـ LLM، وتتبع الوجوه ببايثون، والدمج الصوتي، والرندرة بـ FFmpeg، والرفع إلى R2، واستعادة المهام العالقة تعمل بدون أي اختبار برمجي آلي.

---

### 8.4 غياب اختبارات مسارات الاشتراكات والفوترة الحقيقية (Billing Zero Coverage)
- **الملف والسطر:** `src/app/api/billing/checkout/route.ts` و `src/app/api/billing/portal/route.ts` ومجلد `tests/`
- **درجة الخطورة:** **عالي**
- **الدليل المباشر:** لا يوجد ملف اختبار واحد لمسار إنشاء جلسات الدفع (`checkout`) أو بوابة العميل (`portal`) أو دوال معالجة تجديد الفواتير (`handleInvoicePaymentSucceeded`) أو فشلها (`handleInvoicePaymentFailed`).
- **التحليل:** المسار المالي الحساس الذي يعتمد عليه دخل المشروع بالكامل يفتقر إلى شبكة أمان برمجية تضمن عدم حدوث أخطاء فادحة أثناء الشحن أو التجديد.

---

## أهم 10 أولويات (Top 10 Actionable Priorities)

1. **[حرج]** ترقية Next.js فوراً إلى إصدار آمن لمعالجة ثغرات تنفيذ الأوامر عن بُعد دون مصادقة (Critical RCE: GHSA-p293-qw3h-jr36).
2. **[حرج]** تشغيل وسيط عكسي (Nginx أو Caddy) مع تفعيل شهادة SSL وإغلاق المنفذ 3000 عن الوصول العام المباشر.
3. **[حرج]** منع ثغرة استنزاف الرصيد المجاني عبر حجز رصيد تقريبي مسبقاً (Hold Credits) في `projects/route.ts` قبل بدء معالجة الفيديو.
4. **[حرج]** تأمين استخراج `userId` في webhook فواتير Stripe بالاعتماد على `stripeCustomerId` كبديل احتياطي لمنع ضياع رصيد المشتركين نهائياً.
5. **[عالي]** نقل استدعاء `stripe.subscriptions.retrieve` خارج معاملة قاعدة البيانات التفاعلية في webhook Stripe لمنع استنزاف الاتصالات والانهيار.
6. **[عالي]** سحب ميزات الخطة المدفوعة وخفض دور المستخدم إلى `FREE` فور تلقي إشعار فشل الدفع `invoice.payment_failed`.
7. **[عالي]** تضمين قيود حجم الرفع القصوى في توقيع الروابط الموقعة لـ Cloudflare R2 لمنع رفع ملفات ضخمة تتجاوز الحدود المسموحة.
8. **[عالي]** تفعيل خدمة التخزين المؤقت Upstash Redis لتشغيل نظام حماية المعدل (Rate Limiting) المعطل حالياً على مسارات المصادقة والمشاريع.
9. **[عالي]** إنشاء واستدعاء مستخدم نظام محدود الصلاحيات بدلاً من `root` لتشغيل عمليات PM2 على خادم الإنتاج.
10. **[عالي]** جدولة سكريبت النسخ الاحتياطي `deploy/backup.sh` وتفعيل نظام مراقبة خارجي ينبه عند توقف الخادم أو الخدمة.

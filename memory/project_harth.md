---
name: Harth Platform Project
description: منصة حرث - سوق زراعي عماني كامل (بائع/مشتري/مندوب)
type: project
---

منصة حرث هي سوق زراعي عماني متكامل للبيع والإيجار والتوصيل.

**Stack:** Node.js + Express + PostgreSQL (Knex) + Vanilla JS frontend (HTML/CSS/JS)

**أهم الملفات:**
- Backend: `server/src/controllers/`, `server/src/repositories/`, `server/src/services/`
- Frontend: `basket.html`, `tools.html`, `checkout.html`, `delivery.html`, `my-orders.html`
- Shared JS: `script.js`, `nav.js`, `design-system.js`
- CSS: `design-system.css`, `style.css`, `responsive.css`

**إصلاحات تم تطبيقها (2026-05-08):**
1. **COD orders**: أضيف إنشاء `delivery_request` مباشرة عند تأكيد طلب الدفع عند الاستلام + إشعار المندوبين
2. **Rental to Cart**: تعديل `tools.html` لإضافة المعدات للسلة (localStorage) بدل التأكيد المباشر
   - مفتاح localStorage: `harth_rental_cart`
   - `checkout.html` يعرض سلة الإيجار ويتيح تأكيدها
3. **Order History**: إنشاء `my-orders.html` - سجل طلبات كامل مع فلتر/بحث/إعادة طلب
4. **Dropdown CSS**: إصلاح `.hs-select` و `.filters-bar select` لعرض خيارات واضحة (خلفية بيضاء صلبة + option styling)
5. **Navigation**: `nav.js` يضيف رابط "طلباتي" و "الولاء" لكل المستخدمين المسجلين + زر طلباتي في منطقة الحساب

**Why:** COD orders were not creating delivery requests, rentals went directly to confirmation without cart review, no order history existed for customers, and select dropdowns had transparent backgrounds making options invisible.

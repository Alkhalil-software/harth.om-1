/**
 * equipment-pdf.js — Harth Platform
 * Generates a professional Arabic RTL technical datasheet for equipment listings.
 * Opens a print-ready HTML page in a new browser tab; user prints to PDF.
 */
(function () {
  "use strict";

  const CAT_AR = {
    tractor: "جرارات زراعية", sprayer: "مرشات ومبيدات", harvester: "حصادات",
    tools: "أدوات وملحقات", seeds: "بذور وشتلات", fertilizer: "أسمدة",
    pesticide: "مبيدات حشرية", other: "أخرى",
  };
  const STATUS_AR = {
    available: "متاح للاستخدام", rented: "مؤجر حالياً",
    maintenance: "قيد الصيانة", sold: "مباع", hidden: "مخفي",
  };
  const LISTING_AR = { rent: "للإيجار", sale: "للبيع", both: "بيع وإيجار" };
  const GOV_AR = {
    muscat: "مسقط", dhofar: "ظفار", musandam: "مسندم", buraimi: "البريمي",
    dakhiliyah: "الداخلية", north_batinah: "شمال الباطنة",
    south_batinah: "جنوب الباطنة", south_sharqiyah: "جنوب الشرقية",
    north_sharqiyah: "شمال الشرقية", dhahirah: "الظاهرة", wusta: "الوسطى",
  };
  const FUEL_AR = {
    diesel: "ديزل", gasoline: "بنزين", electric: "كهرباء",
    hybrid: "هجين (كهربائي + بنزين)", gas: "غاز طبيعي",
  };

  function esc(s) {
    if (s == null || s === "") return "";
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
    );
  }

  function specCard(label, value) {
    if (value === null || value === undefined || value === "") return "";
    return `<div class="sc"><div class="sc-lbl">${esc(label)}</div><div class="sc-val">${esc(String(value))}</div></div>`;
  }

  function generateEquipmentPDF(eq) {
    if (!eq) return;

    const specs   = (typeof eq.specs === "object" && eq.specs !== null) ? eq.specs : {};
    const imgs    = Array.isArray(eq.images) ? eq.images : [];
    const primary = eq.primary_image_url || imgs[0] || "";
    const extras  = imgs.filter(u => u !== primary).slice(0, 4);

    const pageUrl    = window.location.origin + "/tools.html";
    const listingUrl = pageUrl + "#eq-" + (eq.id || "");
    const qrData     = encodeURIComponent(listingUrl);
    const qrUrl      = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&color=0d1f07&bgcolor=ffffff&data=${qrData}`;

    const docId   = (eq.id || "").slice(0, 8).toUpperCase();
    const docDate = new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });

    const catLabel     = CAT_AR[eq.category]     || eq.category     || "";
    const statusLabel  = STATUS_AR[eq.status]    || eq.status       || "";
    const listingLabel = LISTING_AR[eq.listing_type] || eq.listing_type || "";
    const govLabel     = GOV_AR[eq.governorate]  || eq.governorate  || "";
    const fuelLabel    = FUEL_AR[specs.fuel_type] || specs.fuel_type || "";

    // Price row
    const priceParts = [];
    if (eq.daily_price != null && eq.daily_price !== "")
      priceParts.push(`<span class="pr-main">${Number(eq.daily_price).toFixed(2)} ر.ع</span><span class="pr-unit"> / يوم (إيجار)</span>`);
    if (eq.sale_price != null && eq.sale_price !== "")
      priceParts.push(`<span class="pr-main">${Number(eq.sale_price).toFixed(2)} ر.ع</span><span class="pr-unit"> (بيع نهائي)</span>`);
    const priceHtml = priceParts.join("<br>") || `<span class="pr-unit">السعر بالتفاوض</span>`;

    // Maintenance section
    const hasMaint = specs.last_maintenance_date || specs.maintenance_type || specs.maintenance_by || specs.next_maintenance_date;
    const maintRows = [
      specs.last_maintenance_date  && `<tr><td>تاريخ آخر صيانة</td><td>${esc(specs.last_maintenance_date)}</td></tr>`,
      specs.maintenance_type       && `<tr><td>نوع الصيانة</td><td>${esc(specs.maintenance_type)}</td></tr>`,
      specs.maintenance_by         && `<tr><td>الجهة المنفذة</td><td>${esc(specs.maintenance_by)}</td></tr>`,
      specs.next_maintenance_date  && `<tr><td>موعد الصيانة القادمة</td><td>${esc(specs.next_maintenance_date)}</td></tr>`,
    ].filter(Boolean).join("");

    const maintSection = hasMaint ? `
      <div class="section">
        <div class="sec-title"><span class="sec-icon">🔧</span> سجل الصيانة الدورية</div>
        <table class="maint-tbl">
          <thead><tr><th>البيان</th><th>التفاصيل</th></tr></thead>
          <tbody>${maintRows}</tbody>
        </table>
      </div>` : "";

    // Warranty section
    const hasWarranty = specs.warranty_info || specs.inspection_cert;
    const warrantySection = hasWarranty ? `
      <div class="section">
        <div class="sec-title"><span class="sec-icon">🛡️</span> الضمان والشهادات الفنية</div>
        <div class="sc-grid">
          ${specCard("معلومات الضمان", specs.warranty_info)}
          ${specCard("شهادة الفحص الفني", specs.inspection_cert)}
        </div>
      </div>` : "";

    // Gallery
    const gallerySection = extras.length ? `
      <div class="section">
        <div class="sec-title"><span class="sec-icon">📸</span> صور إضافية للمعدة</div>
        <div class="gal-grid">
          ${extras.map(u => `<img src="${esc(u)}" alt="" crossorigin="anonymous">`).join("")}
        </div>
      </div>` : "";

    // Owner-uploaded PDF link (shown inside the datasheet if exists)
    const ownerPdf = specs.datasheet_pdf_url
      ? `<div class="owner-pdf-note">📄 الملف الرسمي من المالك: <a href="${esc(specs.datasheet_pdf_url)}" target="_blank">${esc(specs.datasheet_pdf_url)}</a></div>`
      : "";

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>الملف الفني — ${esc(eq.name)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Cairo',sans-serif;direction:rtl;background:#edf2ed;color:#1a1a1a;font-size:13px;line-height:1.55}

    /* ── Action bar (hidden on print) ── */
    .ab{position:fixed;top:0;left:0;right:0;background:#0d1f07;color:#fff;padding:9px 20px;display:flex;gap:8px;align-items:center;z-index:9999;box-shadow:0 2px 10px rgba(0,0,0,.5)}
    .ab-title{margin-inline-end:auto;font-size:13px;opacity:.75;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:50%}
    .ab button{background:#6ab04c;color:#fff;border:none;padding:7px 18px;border-radius:6px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:.15s;white-space:nowrap}
    .ab button:hover{background:#5a9a3c}
    .ab .btn-sec{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2)}
    .ab .btn-sec:hover{background:rgba(255,255,255,.2)}
    .spacer{height:52px}

    /* ── Page ── */
    .page{width:794px;margin:20px auto 48px;background:#fff;box-shadow:0 6px 40px rgba(0,0,0,.18);border-radius:2px}

    /* ── Header ── */
    .hdr{background:linear-gradient(135deg,#0d1f07 0%,#1a3a0a 45%,#2d6018 100%);color:#fff;padding:22px 28px 20px;display:flex;justify-content:space-between;align-items:center;gap:16px}
    .hdr-left .pl-name{font-size:22px;font-weight:800;letter-spacing:.4px}
    .hdr-left .pl-sub{font-size:10px;opacity:.6;margin-top:3px}
    .hdr-right{text-align:left;font-size:10px;opacity:.6;line-height:1.9}
    .hdr-stripe{height:5px;background:linear-gradient(90deg,#6ab04c 0%,#a8e090 50%,#6ab04c 100%)}

    /* ── Hero ── */
    .hero{display:flex;min-height:200px}
    .hero-img{width:270px;flex-shrink:0;overflow:hidden;background:#e5e7eb;display:flex;align-items:center;justify-content:center}
    .hero-img img{width:100%;height:100%;object-fit:cover;display:block}
    .hero-ph{font-size:72px;color:#ccc}
    .hero-info{padding:22px 26px;flex:1;display:flex;flex-direction:column;gap:10px;border-bottom:3px solid #6ab04c}
    .hi-cat{font-size:10px;color:#6ab04c;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}
    .hi-name{font-size:24px;font-weight:800;color:#0d1f07;line-height:1.25;margin-bottom:2px}
    .hi-badges{display:flex;gap:6px;flex-wrap:wrap}
    .badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
    .b-rent{background:#e8f5e9;color:#1b5e20;border:1px solid #a5d6a7}
    .b-sale{background:#e3f2fd;color:#0d47a1;border:1px solid #90caf9}
    .b-both{background:#f3e5f5;color:#6a1b9a;border:1px solid #ce93d8}
    .b-avail{background:#e8f5e9;color:#1b5e20;border:1px solid #a5d6a7}
    .b-status{background:#fff3e0;color:#bf360c;border:1px solid #ffcc80}
    .hi-price{line-height:1.8}
    .pr-main{font-size:20px;font-weight:800;color:#0d1f07}
    .pr-unit{font-size:11px;color:#666}
    .hi-loc{font-size:12px;color:#777}

    /* ── Sections ── */
    .section{padding:18px 28px;border-bottom:1px solid #edf0ed}
    .sec-title{font-size:13px;font-weight:700;color:#0d1f07;padding-bottom:8px;border-bottom:2px solid #6ab04c;margin-bottom:14px;display:flex;align-items:center;gap:6px}
    .sec-icon{font-size:15px}

    /* ── Spec cards grid ── */
    .sc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    .sc{background:#f7fdf7;border:1px solid #d8eed8;border-radius:9px;padding:10px 13px}
    .sc-lbl{font-size:9px;color:#888;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px}
    .sc-val{font-size:13px;font-weight:700;color:#1a1a1a}

    /* ── Maintenance table ── */
    .maint-tbl{width:100%;border-collapse:collapse;font-size:12px}
    .maint-tbl th{background:#f0f9f0;color:#1b5e20;font-weight:700;padding:9px 14px;text-align:right;border:1px solid #c8e6c9}
    .maint-tbl td{padding:8px 14px;border:1px solid #e5e7eb;color:#444}
    .maint-tbl tr:nth-child(even) td{background:#f9fcf9}

    /* ── Gallery ── */
    .gal-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    .gal-grid img{width:100%;height:110px;object-fit:cover;border-radius:7px;border:1px solid #e0e0e0}

    /* ── Description ── */
    .desc{font-size:13px;color:#444;line-height:1.85;white-space:pre-line}

    /* ── Owner PDF note ── */
    .owner-pdf-note{margin-top:10px;padding:10px 14px;background:#f0f9ff;border:1px solid #90caf9;border-radius:7px;font-size:12px;color:#1565c0}
    .owner-pdf-note a{color:#1565c0;word-break:break-all}

    /* ── Footer ── */
    .footer{display:flex;padding:20px 28px;align-items:center;gap:20px;background:#f0f9f0;border-top:3px solid #6ab04c}
    .qr-wrap{text-align:center;flex-shrink:0}
    .qr-wrap img{width:100px;height:100px;border:2px solid #6ab04c;border-radius:8px;padding:3px;background:#fff}
    .qr-lbl{font-size:9px;color:#888;margin-top:4px}
    .f-info{flex:1}
    .f-brand{font-size:15px;font-weight:800;color:#0d1f07;margin-bottom:5px}
    .f-text{font-size:10px;color:#666;line-height:1.9;word-break:break-all}
    .f-stamp{border:2px solid #6ab04c;border-radius:4px;padding:7px 14px;text-align:center;color:#1b5e20;font-size:10px;font-weight:700;transform:rotate(-12deg);display:inline-block;margin-top:10px;line-height:1.5}

    /* ── Print ── */
    @media print{
      .ab,.spacer{display:none!important}
      body{background:#fff}
      .page{box-shadow:none;margin:0;width:100%;border-radius:0}
      @page{margin:1.2cm;size:A4 portrait}
    }
    @media(max-width:820px){
      .page{width:100%;margin:0}
      .sc-grid{grid-template-columns:repeat(2,1fr)}
      .gal-grid{grid-template-columns:repeat(2,1fr)}
      .hero{flex-direction:column}
      .hero-img{width:100%;height:220px}
    }
  </style>
</head>
<body>
  <div class="ab">
    <span class="ab-title">الملف الفني — ${esc(eq.name)}</span>
    <button class="btn-sec" onclick="window.close()">✕ إغلاق</button>
    <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
  </div>
  <div class="spacer"></div>

  <div class="page">

    <!-- Header -->
    <div class="hdr">
      <div class="hdr-left">
        <div class="pl-name">🌿 منصة حرث</div>
        <div class="pl-sub">الملف الفني للمعدة الزراعية &nbsp;·&nbsp; Agricultural Equipment Datasheet</div>
      </div>
      <div class="hdr-right">
        <div>رقم المستند: EQ-${docId}</div>
        <div>تاريخ الإصدار: ${docDate}</div>
        <div>مُولَّد تلقائياً</div>
      </div>
    </div>
    <div class="hdr-stripe"></div>

    <!-- Hero -->
    <div class="hero">
      <div class="hero-img">
        ${primary
          ? `<img src="${esc(primary)}" alt="${esc(eq.name)}" crossorigin="anonymous">`
          : `<span class="hero-ph">🚜</span>`}
      </div>
      <div class="hero-info">
        <div class="hi-cat">${esc(catLabel)}</div>
        <div class="hi-name">${esc(eq.name)}</div>
        <div class="hi-badges">
          <span class="badge ${eq.listing_type === "sale" ? "b-sale" : eq.listing_type === "both" ? "b-both" : "b-rent"}">${esc(listingLabel)}</span>
          <span class="badge ${eq.status === "available" ? "b-avail" : "b-status"}">${esc(statusLabel)}</span>
        </div>
        <div class="hi-price">${priceHtml}</div>
        ${govLabel ? `<div class="hi-loc">📍 ${esc(govLabel)}</div>` : ""}
      </div>
    </div>

    <!-- Identification -->
    <div class="section">
      <div class="sec-title"><span class="sec-icon">🔖</span> بيانات التعريف والهوية</div>
      <div class="sc-grid">
        ${specCard("الشركة المصنعة", specs.manufacturer)}
        ${specCard("الموديل", specs.model)}
        ${specCard("سنة الصنع", specs.model_year)}
        ${specCard("الرقم التسلسلي", specs.serial_number)}
        ${specCard("بلد المنشأ", specs.origin_country)}
        ${specCard("ساعات التشغيل", specs.operating_hours != null ? specs.operating_hours + " ساعة" : null)}
        ${specCard("نوع الوقود / الطاقة", fuelLabel)}
        ${specCard("حالة المعدة", statusLabel)}
        ${specCard("التصنيف", catLabel)}
      </div>
    </div>

    <!-- Technical specs -->
    <div class="section">
      <div class="sec-title"><span class="sec-icon">⚙️</span> المواصفات الفنية التفصيلية</div>
      <div class="sc-grid">
        ${specCard("القدرة المحركية", specs.engine_power_hp != null ? specs.engine_power_hp + " حصان (HP)" : null)}
        ${specCard("الوزن الإجمالي", specs.weight_kg != null ? specs.weight_kg + " كجم" : null)}
        ${specCard("الحمولة القصوى", specs.load_capacity_kg != null ? specs.load_capacity_kg + " كجم" : null)}
        ${specCard("الطول", specs.dimension_length != null ? specs.dimension_length + " سم" : null)}
        ${specCard("العرض", specs.dimension_width != null ? specs.dimension_width + " سم" : null)}
        ${specCard("الارتفاع", specs.dimension_height != null ? specs.dimension_height + " سم" : null)}
      </div>
    </div>

    ${maintSection}
    ${warrantySection}

    ${eq.description ? `
    <div class="section">
      <div class="sec-title"><span class="sec-icon">📝</span> وصف المعدة</div>
      <div class="desc">${esc(eq.description)}</div>
    </div>` : ""}

    ${gallerySection}
    ${ownerPdf}

    <!-- Footer -->
    <div class="footer">
      <div class="qr-wrap">
        <img src="${qrUrl}" alt="QR" onerror="this.parentElement.style.display='none'">
        <div class="qr-lbl">امسح للوصول للإعلان</div>
      </div>
      <div class="f-info">
        <div class="f-brand">🌿 منصة حرث للمعدات الزراعية</div>
        <div class="f-text">
          منصة متخصصة في تأجير وبيع المعدات الزراعية بشكل آمن وموثوق.<br>
          رابط الإعلان: ${esc(listingUrl)}<br>
          هذا الملف مُولَّد تلقائياً من بيانات الإعلان · تاريخ الإصدار: ${docDate}
        </div>
        <div class="f-stamp">وثيقة فنية<br>Technical<br>Datasheet</div>
      </div>
    </div>

  </div><!-- /page -->
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, "_blank");
    if (win) setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    else {
      // Fallback if popup was blocked
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `harth-datasheet-${(eq.name || "equipment").replace(/\s+/g, "-")}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    }
  }

  window.generateEquipmentPDF = generateEquipmentPDF;
})();

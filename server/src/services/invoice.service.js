/**
 * Invoice PDF generator.
 *
 * Uses pdfkit (pure JS, no headless browser) + qrcode (SVG string rendered
 * inline). If either module is missing, we return a clear error — neither
 * has a graceful fallback that would produce a meaningful invoice.
 *
 * The service streams the PDF to a writable (res or file stream) so we
 * never buffer the whole document in memory.
 */
const env = require("../config/env");

let PDFDocument = null;
let QRCode = null;
try {
  PDFDocument = require("pdfkit");
} catch (_e) {
  // Installed lazily via `npm install` from the updated package.json.
}
try {
  QRCode = require("qrcode");
} catch (_e) {}

const isAvailable = !!(PDFDocument && QRCode);

/**
 * Generate an invoice PDF and pipe it to the given stream.
 *
 * @param {object} order       order row from the DB
 * @param {Array}  items       order_items rows
 * @param {object} user        { name, email } of the buyer
 * @param {Writable} stream    response or file stream
 */
async function streamInvoice({ order, items, user, stream }) {
  if (!isAvailable) {
    throw new Error(
      "Invoice generation unavailable: install pdfkit and qrcode (npm install)",
    );
  }

  // A4 size, ~72pt per inch. Leave generous margins.
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    info: {
      Title: `Invoice ${order.tracking_number}`,
      Author: "Harth",
    },
  });

  doc.pipe(stream);

  // ── Header ─────────────────────────────────────────────────────────
  doc
    .fontSize(22)
    .fillColor("#2d5016")
    .text("حرث - HARTH", { align: "right" });
  doc
    .fontSize(10)
    .fillColor("#666")
    .text("Agricultural Equipment Platform", { align: "right" });
  doc.moveDown(0.5);

  doc
    .moveTo(40, doc.y)
    .lineTo(555, doc.y)
    .strokeColor("#6ab04c")
    .lineWidth(2)
    .stroke();
  doc.moveDown();

  // ── Invoice meta + QR ──────────────────────────────────────────────
  const metaTop = doc.y;

  doc
    .fontSize(18)
    .fillColor("#1a1a1a")
    .text("INVOICE / فاتورة", 40, metaTop);
  doc
    .fontSize(10)
    .fillColor("#333")
    .text(`Invoice #: ${order.tracking_number}`, 40, metaTop + 28)
    .text(`Date: ${formatDate(order.created_at)}`)
    .text(`Status: ${order.status}`)
    .text(`Payment: ${order.payment_status}`);

  // QR code for tracking. Build a deep link to the tracking page.
  const trackUrl =
    (env.PUBLIC_BASE_URL || "https://harth.example")
      .replace(/\/+$/, "") + `/track.html?t=${order.tracking_number}`;

  const qrDataUrl = await QRCode.toDataURL(trackUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 4,
  });
  // QR image in the top-right
  const qrBuffer = Buffer.from(qrDataUrl.split(",")[1], "base64");
  doc.image(qrBuffer, 455, metaTop, { width: 100, height: 100 });
  doc
    .fontSize(8)
    .fillColor("#666")
    .text("Scan to track", 455, metaTop + 102, {
      width: 100,
      align: "center",
    });

  doc.moveDown(4);

  // ── Bill-to ────────────────────────────────────────────────────────
  const billY = Math.max(doc.y, metaTop + 130);
  doc
    .fontSize(11)
    .fillColor("#1a1a1a")
    .text("BILL TO", 40, billY, { underline: true });
  doc
    .fontSize(10)
    .fillColor("#333")
    .text(user.name || "Customer", 40, billY + 14)
    .text(user.email || "");

  const ship =
    typeof order.shipping_address === "string"
      ? safeJson(order.shipping_address)
      : order.shipping_address || {};
  if (ship) {
    if (ship.street) doc.text(ship.street);
    if (ship.city) doc.text(ship.city);
    if (ship.phone) doc.text(`Phone: ${ship.phone}`);
  }

  doc.moveDown(2);

  // ── Items table ────────────────────────────────────────────────────
  const tableTop = doc.y;
  const colX = { item: 40, qty: 320, price: 390, total: 475 };

  doc
    .fontSize(10)
    .fillColor("#fff")
    .rect(40, tableTop, 515, 22)
    .fillAndStroke("#6ab04c", "#6ab04c");
  doc
    .fillColor("#fff")
    .text("Item", colX.item + 6, tableTop + 6)
    .text("Qty", colX.qty, tableTop + 6, { width: 60, align: "right" })
    .text("Unit Price", colX.price, tableTop + 6, { width: 75, align: "right" })
    .text("Total", colX.total, tableTop + 6, { width: 75, align: "right" });

  let y = tableTop + 28;
  doc.fillColor("#1a1a1a").fontSize(10);

  for (const it of items) {
    // simple row divider
    doc
      .strokeColor("#ececec")
      .lineWidth(0.5)
      .moveTo(40, y + 18)
      .lineTo(555, y + 18)
      .stroke();

    doc.text(it.equipment_name_snapshot || "Item", colX.item + 4, y, {
      width: 270,
    });
    doc.text(String(it.quantity), colX.qty, y, { width: 60, align: "right" });
    doc.text(money(it.price_per_unit), colX.price, y, {
      width: 75,
      align: "right",
    });
    doc.text(money(it.line_total), colX.total, y, {
      width: 75,
      align: "right",
    });
    y += 22;

    // crude page break — let PDFKit handle it by checking near the bottom
    if (y > 700) {
      doc.addPage();
      y = 40;
    }
  }

  // ── Totals block ───────────────────────────────────────────────────
  y += 10;
  const totalsX = 330;
  const lineHeight = 18;

  const totalsLines = [
    ["Subtotal", order.subtotal],
    ["Discount", order.discount, true],
    ["Tax (10%)", order.tax],
    ["Shipping", order.shipping_fee],
    ["Loyalty Used", order.loyalty_points_used, true],
  ];

  doc.fontSize(10).fillColor("#333");
  for (const [label, val, negative] of totalsLines) {
    const amount = Number(val || 0);
    if (!amount && label !== "Subtotal") continue;
    doc.text(`${label}:`, totalsX, y, { width: 120, align: "left" });
    doc.text(`${negative && amount > 0 ? "-" : ""}${money(amount)} OMR`, totalsX + 120, y, {
      width: 100,
      align: "right",
    });
    y += lineHeight;
  }

  // Total — emphasised
  y += 4;
  doc.strokeColor("#333").lineWidth(1).moveTo(totalsX, y).lineTo(555, y).stroke();
  y += 6;
  doc
    .fontSize(13)
    .fillColor("#2d5016")
    .text("TOTAL:", totalsX, y, { width: 120, align: "left" });
  doc.text(`${money(order.total)} OMR`, totalsX + 120, y, {
    width: 100,
    align: "right",
  });

  // ── Footer ─────────────────────────────────────────────────────────
  doc
    .fontSize(9)
    .fillColor("#888")
    .text(
      "Thank you for choosing Harth. Track your order using the QR code above or visit our website.",
      40,
      760,
      { width: 515, align: "center" },
    );

  doc.end();
}

function formatDate(d) {
  try {
    return new Date(d).toISOString().replace("T", " ").slice(0, 16);
  } catch (_e) {
    return String(d);
  }
}
function money(n) {
  const v = Number(n || 0);
  return v.toFixed(2);
}
function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch (_e) {
    return null;
  }
}

module.exports = { streamInvoice, isAvailable };

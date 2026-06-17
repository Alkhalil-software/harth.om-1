const equipmentRepo = require("../repositories/equipment.repository");
const trustRepo = require("../repositories/trust.repository");
const knex = require("../db");
const notificationService = require("../services/notification.service");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

/**
 * Shape-check helper. Converts JSON-compatible values from the request into
 * what the DB expects (JSONB columns need stringified JSON via Knex helpers
 * or we can pass raw objects — Knex/pg handles both; we normalize here).
 */
function normalizeForDb(body) {
  const out = { ...body };

  // Coerce empty-string numbers to null, otherwise cast to Number.
  ["daily_price", "sale_price", "deposit_amount"].forEach((k) => {
    if (out[k] === "" || out[k] === undefined) out[k] = null;
    else if (out[k] !== null) out[k] = Number(out[k]);
  });
  if (out.stock !== undefined && out.stock !== null) {
    out.stock = parseInt(out.stock, 10);
  }

  // JSON fields — stringify so pg's JSONB column accepts them. Passing a
  // plain object to Knex with .jsonb usually works, but being explicit is
  // safer across driver versions.
  ["images", "specs", "location"].forEach((k) => {
    if (out[k] !== undefined && out[k] !== null && typeof out[k] !== "string") {
      out[k] = JSON.stringify(out[k]);
    }
  });

  return out;
}

/**
 * Attach a compact trust profile (badges + key stats) to each equipment
 * item. Computed in one pass over the unique owner ids — a 20-item page
 * with 8 distinct owners hits the DB 8 times for trust, not 20.
 *
 * Mutates and returns the items array for chainability.
 */
async function decorateWithTrust(items) {
  if (!items || !items.length) return items;
  const ownerIds = items.map((i) => i.owner_id).filter(Boolean);
  const profileMap = await trustRepo.computeForOwners(ownerIds);
  for (const item of items) {
    const p = profileMap.get(item.owner_id);
    item.trust = trustRepo.compact(p);
  }
  return items;
}

/**
 * GET /equipment
 * Public. Supports filters, pagination, sort, full-text search.
 */
const list = asyncHandler(async (req, res) => {
  const {
    page,
    limit,
    category,
    listing_type,
    status,
    min_price,
    max_price,
    min_rating,
    search,
    sort,
  } = req.query;

  const isAdmin = req.user?.role === "admin";
  const result = await equipmentRepo.list({
    page,
    limit,
    sort,
    includeHidden: isAdmin,
    filters: {
      category,
      listing_type,
      status,
      min_price,
      max_price,
      min_rating,
      search,
    },
  });

  await decorateWithTrust(result.items);
  res.json({ success: true, ...result });
});

/**
 * GET /equipment/mine
 * Owner-only: lists the caller's equipment, including hidden items.
 * Must come before /equipment/:id in the route table.
 */
const listMine = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await equipmentRepo.listByOwner(req.user.id, { page, limit });
  // Owner viewing their own listings doesn't need trust badges, but it's
  // cheap to include and the dashboard shows them as a self-check.
  await decorateWithTrust(result.items);
  res.json({ success: true, ...result });
});

/**
 * GET /equipment/:id
 */
const getOne = asyncHandler(async (req, res) => {
  const item = await equipmentRepo.getById(req.params.id);
  if (!item) throw new AppError("Equipment not found", 404);
  // Single-item view gets the full profile (not the compact one) so the
  // detail page can show a richer trust section.
  if (item.owner_id) {
    const profile = await trustRepo.computeForOwner(item.owner_id);
    item.trust = profile; // full profile, not compact
  }
  res.json({ success: true, item });
});

/**
 * POST /equipment
 * Owner- or admin-only. Creates a new listing owned by the caller.
 */
const create = asyncHandler(async (req, res) => {
  const payload = normalizeForDb(req.body);

  // Never trust the client to set owner_id.
  payload.owner_id = req.user.id;

  // Default status if not provided.
  if (!payload.status) payload.status = "available";

  // If primary_image_url not given but images has one, use the first.
  if (!payload.primary_image_url && Array.isArray(req.body.images) && req.body.images.length) {
    payload.primary_image_url = req.body.images[0];
  }

  const item = await equipmentRepo.create(payload);

  // Tell every admin a new listing is pending. Fire-and-forget — a notification
  // failure shouldn't block the owner's creation.
  notifyAdminsOfNewListing(item, req.user).catch((e) => {
    // eslint-disable-next-line no-console
    console.error("[notify admins] failed:", e.message);
  });

  res.status(201).json({ success: true, item });
});

/**
 * Fan out a "new listing pending" notification to all active admins.
 */
async function notifyAdminsOfNewListing(equipment, owner) {
  const knex = require("../db");
  const notificationService = require("../services/notification.service");
  const admins = await knex("users")
    .where({ role: "admin", is_active: true })
    .select("id");
  await Promise.all(
    admins.map((a) =>
      notificationService.notify({
        userId: a.id,
        type: "system",
        title: "معدة جديدة بانتظار الموافقة",
        message: `أضاف ${owner.name || owner.email} معدة "${equipment.name}" وتحتاج مراجعتك.`,
        metadata: { equipment_id: equipment.id, owner_id: owner.id },
      }),
    ),
  );
}

/**
 * PATCH /equipment/:id
 * Owner must be the owner of the equipment, or an admin.
 */
const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await equipmentRepo.getById(id);
  if (!existing) throw new AppError("Equipment not found", 404);

  const isAdmin = req.user.role === "admin";
  if (!isAdmin && existing.owner_id !== req.user.id) {
    throw new AppError("You do not own this equipment", 403);
  }

  const payload = normalizeForDb(req.body);

  // owner_id is not editable from here; prevent privilege escalation.
  delete payload.owner_id;

  const item = await equipmentRepo.update(id, payload);

  // Price-drop alerts. We compare the OLD vs NEW price for both
  // daily_price and sale_price independently — a listing might be
  // both for-rent and for-sale. If either dropped, notify every user
  // who has this equipment in their wishlist.
  //
  // Fire-and-forget: a notification fan-out failure must not block the
  // PATCH response. notifyPriceDrop catches its own errors.
  notifyPriceDropIfNeeded(existing, item).catch((e) => {
    // eslint-disable-next-line no-console
    console.error("[price-drop notify failed]", e.message);
  });

  res.json({ success: true, item });
});

/**
 * For each price field that decreased between `before` and `after`,
 * notify all wishlisters. We dedupe across fields — a listing whose
 * BOTH prices dropped at once still produces ONE notification per user
 * with both deltas summarised.
 *
 * Why not push this into a queue? At today's scale (small Oman pilot)
 * a synchronous fan-out for ≤500 wishlisters per listing finishes in
 * tens of ms. If a listing ever has 10k wishlisters we'd want a queue;
 * the call site is a single function, easy to swap.
 */
async function notifyPriceDropIfNeeded(before, after) {
  const drops = [];

  // Helper: did the price decrease? null/undefined → null/undefined
  // is "no change", null → number is "introduced a price" (also worth
  // alerting), number → null is "removed price" (don't alert), and
  // a smaller number is the typical drop case.
  const dropOf = (label, oldV, newV) => {
    const o = oldV == null ? null : Number(oldV);
    const n = newV == null ? null : Number(newV);
    if (n == null) return null;          // removed → ignore
    if (o == null) return null;          // newly added → don't spam wishlisters
    if (n >= o) return null;             // unchanged or increased
    return {
      label,
      old_price: o,
      new_price: n,
      delta: o - n,
      pct_off: Math.round(((o - n) / o) * 100),
    };
  };

  const dailyDrop = dropOf("daily_price", before.daily_price, after.daily_price);
  const saleDrop = dropOf("sale_price", before.sale_price, after.sale_price);
  if (dailyDrop) drops.push(dailyDrop);
  if (saleDrop) drops.push(saleDrop);

  if (!drops.length) return;

  // Find all users who have this equipment wishlisted.
  const wishlisters = await knex("wishlist_items")
    .where({ equipment_id: after.id })
    .select("user_id");

  if (!wishlisters.length) return;

  // Compose a single message that mentions every dropped field.
  const headline = drops
    .map((d) => {
      const what =
        d.label === "daily_price" ? "سعر الإيجار اليومي" : "سعر البيع";
      return `${what}: ${d.old_price} → ${d.new_price} ر.ع (-${d.pct_off}%)`;
    })
    .join("، ");

  const title = "📉 انخفض سعر معدة في قائمة المفضلة";
  const message = `معدة "${after.name}" التي أضفتها للمفضّلة انخفض سعرها. ${headline}.`;

  // Fan-out — Promise.allSettled so a single failed user doesn't
  // abort the rest. We cap at 500 users per fan-out to keep latency
  // reasonable; if a listing has more, the rest will still see the
  // new price next time they browse.
  const cap = 500;
  await Promise.allSettled(
    wishlisters.slice(0, cap).map((w) =>
      notificationService.notify({
        userId: w.user_id,
        type: "promo",          // matches the existing notification_type enum
        title,
        message,
        metadata: {
          equipment_id: after.id,
          drops,
          kind: "wishlist_price_drop",
        },
        // Email opt-in: yes for price drops — this is exactly the
        // alert wishlisters opted in for by hearting the listing.
        email: true,
      }),
    ),
  );
}

/**
 * DELETE /equipment/:id
 * Same authorization rules as update.
 */
const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await equipmentRepo.getById(id);
  if (!existing) throw new AppError("Equipment not found", 404);

  const isAdmin = req.user.role === "admin";
  if (!isAdmin && existing.owner_id !== req.user.id) {
    throw new AppError("You do not own this equipment", 403);
  }

  try {
    await equipmentRepo.remove(id);
    res.json({ success: true });
  } catch (err) {
    // FK violation (23503): equipment has linked orders — soft-delete instead
    // so order history is preserved while the listing disappears from all views.
    if (err.code === "23503") {
      await equipmentRepo.update(id, { status: "hidden", approval_status: "rejected" });
      res.json({ success: true, note: "المعدة مرتبطة بطلبات سابقة، تم إخفاؤها بدلاً من الحذف النهائي" });
    } else {
      throw err;
    }
  }
});

module.exports = { list, listMine, getOne, create, update, remove };

// 025. Hero banners — admin-managed promotional banners shown on the
// homepage above the fold and at section breaks.
//
// Use cases:
//   - "Spring planting offers" rotating hero image with a CTA.
//   - Limited-time discount campaigns (Ramadan, harvest season).
//   - Spotlight on a new feature (PRO membership, KYC rollout).
//
// Why a dedicated table instead of reusing promo_codes?
//   promo_codes is the *discount* layer (the actual code the customer
//   types or that's auto-applied). hero_banners is the *display* layer.
//   A banner can advertise a promo code, but it can also just send the
//   user to a landing page with no code — the two concepts overlap but
//   aren't the same.
//
// Schema:
//   - placement: where the banner is meant to render. We start with a
//     small fixed vocabulary and let the frontend decide what to do
//     with each value.
//   - active_from / active_until: lifecycle window. The /public/banners
//     endpoint filters on "now BETWEEN active_from AND active_until".
//     Either side can be NULL ⇒ no bound that side.
//   - sort_order: when multiple banners are active for the same
//     placement, low number = first.
//   - cta_url: target of the click-through. The frontend opens it in
//     the same tab unless it's external (different origin).
//   - background_color / text_color: optional design overrides so the
//     admin can tune contrast without a deploy.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.raw(`
    CREATE TYPE banner_placement AS ENUM (
      'home_hero',          -- big top banner / carousel
      'home_secondary',     -- between sections on the homepage
      'tools_top',          -- above the equipment grid in tools.html
      'global_top_strip'    -- thin announcement strip across the site
    );
  `);

  await knex.schema.createTable("hero_banners", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    t.string("title", 200).notNullable();
    t.string("subtitle", 400);

    // Optional banner image. If null, the frontend renders a
    // gradient-only banner using background_color.
    t.string("image_url", 500);

    // Click-through. Can be a relative path (e.g. /tools.html?cat=tractor)
    // or an absolute URL (the frontend handles target=_blank for cross-origin).
    t.string("cta_label", 80);
    t.string("cta_url", 500);

    t.specificType("placement", "banner_placement")
      .notNullable()
      .defaultTo("home_hero");

    // Lifecycle window. NULL means unbounded on that side.
    t.timestamp("active_from", { useTz: true });
    t.timestamp("active_until", { useTz: true });

    t.boolean("is_active").notNullable().defaultTo(true);
    t.integer("sort_order").notNullable().defaultTo(0);

    // Design overrides. Hex strings; null = use the default theme.
    t.string("background_color", 32);
    t.string("text_color", 32);

    // Optional link to a promo code so the click-through pre-fills the
    // checkout discount. We resolve by code rather than ID at the
    // frontend so you can swap promo records without rewriting banners.
    t.string("promo_code", 32);

    // Bookkeeping.
    t.uuid("created_by")
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");

    t.timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    t.index(["placement", "is_active"]);
    t.index(["is_active", "active_from", "active_until"]);
    t.index("sort_order");
  });

  // active_from must precede active_until when both are set.
  await knex.raw(`
    ALTER TABLE hero_banners ADD CONSTRAINT hero_banners_window_valid CHECK (
      active_from IS NULL
      OR active_until IS NULL
      OR active_from <= active_until
    );
  `);

  // Standard updated_at trigger.
  await knex.raw(`
    DROP TRIGGER IF EXISTS set_hero_banners_updated_at ON hero_banners;
    CREATE TRIGGER set_hero_banners_updated_at
    BEFORE UPDATE ON hero_banners
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("hero_banners");
  await knex.raw(`DROP TYPE IF EXISTS banner_placement CASCADE;`);
};

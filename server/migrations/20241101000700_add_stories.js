// 026. Stories — Instagram-style ephemeral posts from farmers.
//
// A farmer publishes one or more "stories" (image + optional caption).
// Each story disappears 24 hours after creation. The point is to
// transform the platform from a transactional marketplace into a
// living community where buyers see what's happening on the farm
// today.
//
// Schema notes:
//   - One row per story (one image). Multiple stories per farmer are
//     just multiple rows; the frontend groups them by author.
//   - `expires_at` is computed at insert time = created_at + 24h.
//     We store it as a real column rather than a generated one so the
//     index actually works on Postgres versions that disallow indexed
//     generated cols. The /public/stories endpoint filters on
//     `expires_at > now()`, ditto the unique index.
//   - `view_count` is a denormalized cache of how many people have
//     opened the story. story_views is the source of truth.
//   - `equipment_id` is optional — a farmer can spotlight a specific
//     listing in the story so a tap on the story jumps straight to
//     the listing. Soft FK (SET NULL) so deleting equipment doesn't
//     wipe a story that mentioned it.
//
// Why not reuse the existing notifications/messages tables?
//   Stories are PUBLIC and viewed by many people; notifications are
//   per-user. Stories are EPHEMERAL; messages are permanent. Different
//   axes, different tables.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  await knex.schema.createTable("stories", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    // Author. Owners and admins post; renters/delivery do not.
    t.uuid("author_id")
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    // The image is the story. We don't support video at v1 (storage cost).
    t.string("image_url", 500).notNullable();

    // Optional caption. Plain text, max 280 chars to keep it tweet-shaped.
    t.string("caption", 280);

    // Optional spotlight on a specific listing.
    t.uuid("equipment_id")
      .references("id")
      .inTable("equipment")
      .onDelete("SET NULL");

    // Cached count, kept in sync via story_views inserts.
    t.integer("view_count").notNullable().defaultTo(0);

    // Lifecycle. expires_at = created_at + 24h, set in app code.
    t.timestamp("expires_at", { useTz: true }).notNullable();

    t.timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());
    t.timestamp("updated_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    // Author index for "stories from a specific farmer".
    t.index(["author_id", "created_at"]);
    // Hot path: "what's currently live?" — order by created_at, filter on expires_at.
    t.index("expires_at");
  });

  // expires_at must be after created_at.
  await knex.raw(`
    ALTER TABLE stories ADD CONSTRAINT stories_expiry_after_creation CHECK (
      expires_at > created_at
    );
  `);

  // View tracker — one row per (story, viewer). The unique index makes
  // re-views idempotent: opening the same story 3 times still counts as 1.
  await knex.schema.createTable("story_views", (t) => {
    t.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));

    t.uuid("story_id")
      .notNullable()
      .references("id")
      .inTable("stories")
      .onDelete("CASCADE");

    // Anonymous viewers (logged-out users browsing the homepage) can
    // still mark a view via their session id. Both columns are nullable
    // — exactly one is enforced by a CHECK constraint.
    t.uuid("viewer_id").references("id").inTable("users").onDelete("SET NULL");
    t.string("anon_session", 64);

    t.timestamp("created_at", { useTz: true })
      .notNullable()
      .defaultTo(knex.fn.now());

    t.index("story_id");
    t.index("viewer_id");
  });

  // Exactly one of viewer_id / anon_session must be present.
  await knex.raw(`
    ALTER TABLE story_views ADD CONSTRAINT story_views_owner_xor CHECK (
      (viewer_id IS NOT NULL AND anon_session IS NULL)
      OR (viewer_id IS NULL AND anon_session IS NOT NULL)
    );
  `);

  // Don't double-count a re-view from the same viewer/session. Two
  // partial unique indexes since one of the two columns is always NULL.
  await knex.raw(`
    CREATE UNIQUE INDEX story_views_unique_user
      ON story_views (story_id, viewer_id)
      WHERE viewer_id IS NOT NULL;
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX story_views_unique_anon
      ON story_views (story_id, anon_session)
      WHERE anon_session IS NOT NULL;
  `);

  // Standard updated_at trigger on stories.
  await knex.raw(`
    DROP TRIGGER IF EXISTS set_stories_updated_at ON stories;
    CREATE TRIGGER set_stories_updated_at
    BEFORE UPDATE ON stories
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  `);
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("story_views");
  await knex.schema.dropTableIfExists("stories");
};

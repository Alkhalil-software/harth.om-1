// 001. Create all ENUM types used across the schema.
// Roles match the product spec: admin, owner, renter, delivery.

/**
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  // Enable pgcrypto for gen_random_uuid() (safe if already enabled)
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await knex.raw(
    `CREATE TYPE user_role AS ENUM ('admin', 'owner', 'renter', 'delivery');`,
  );

  await knex.raw(
    `CREATE TYPE equipment_category AS ENUM ('tractor', 'sprayer', 'harvester', 'tools', 'seeds', 'fertilizer', 'pesticide', 'other');`,
  );

  await knex.raw(
    `CREATE TYPE equipment_status AS ENUM ('available', 'rented', 'maintenance', 'sold', 'hidden');`,
  );

  await knex.raw(
    `CREATE TYPE listing_type AS ENUM ('sale', 'rent', 'both');`,
  );

  await knex.raw(
    `CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded');`,
  );

  await knex.raw(
    `CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');`,
  );

  await knex.raw(
    `CREATE TYPE rental_status AS ENUM ('pending', 'approved', 'active', 'completed', 'cancelled', 'rejected');`,
  );

  await knex.raw(
    `CREATE TYPE delivery_status AS ENUM ('pending', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled');`,
  );

  await knex.raw(`CREATE TYPE promo_type AS ENUM ('percentage', 'fixed');`);

  await knex.raw(
    `CREATE TYPE notification_type AS ENUM ('order', 'rental', 'delivery', 'payment', 'promo', 'message', 'system');`,
  );

  await knex.raw(
    `CREATE TYPE notification_channel AS ENUM ('email', 'whatsapp', 'sms', 'in_app');`,
  );
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = async function (knex) {
  const types = [
    "notification_channel",
    "notification_type",
    "promo_type",
    "delivery_status",
    "rental_status",
    "payment_status",
    "order_status",
    "listing_type",
    "equipment_status",
    "equipment_category",
    "user_role",
  ];
  for (const t of types) {
    await knex.raw(`DROP TYPE IF EXISTS ${t} CASCADE;`);
  }
};

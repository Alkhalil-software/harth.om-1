const knex = require("../db");

/**
 * Cart data access.
 *
 * A cart always exists lazily — we create one the first time the user
 * touches cart APIs. Callers should use getOrCreateCart(userId) rather than
 * hitting the table directly.
 */

/**
 * Fetch the user's cart, creating it if missing. Safe under concurrency
 * because of the UNIQUE(user_id) constraint: if two requests race, one wins
 * the insert and the other gets a 23505 which we catch and retry with a SELECT.
 */
async function getOrCreateCart(userId, trx = knex) {
  let cart = await trx("carts").where({ user_id: userId }).first();
  if (cart) return cart;

  try {
    const [row] = await trx("carts").insert({ user_id: userId }).returning("*");
    return row;
  } catch (err) {
    // Someone else created it in the tiny window between our SELECT and INSERT.
    if (err.code === "23505") {
      return trx("carts").where({ user_id: userId }).first();
    }
    throw err;
  }
}

/**
 * Return the cart with items joined to equipment for display.
 * Equipment that has been deleted (FK cascade) won't appear — that's fine
 * because CASCADE already removed the orphan cart row.
 */
async function getCartWithItems(userId) {
  const cart = await getOrCreateCart(userId);

  const items = await knex("cart_items as ci")
    .join("equipment as e", "e.id", "ci.equipment_id")
    .where("ci.cart_id", cart.id)
    .select(
      "ci.id as cart_item_id",
      "ci.quantity",
      "ci.created_at as added_at",
      "e.id as equipment_id",
      "e.name",
      "e.sale_price",
      "e.daily_price",
      "e.listing_type",
      "e.status",
      "e.stock",
      "e.primary_image_url",
      "e.owner_id",
    )
    .orderBy("ci.created_at", "desc");

  return { cart, items };
}

/**
 * Add or increment a cart item. If already in cart, bump the quantity.
 */
async function addItem(userId, equipmentId, quantity) {
  return knex.transaction(async (trx) => {
    const cart = await getOrCreateCart(userId, trx);

    // Upsert: insert on first add, bump quantity on subsequent adds.
    const existing = await trx("cart_items")
      .where({ cart_id: cart.id, equipment_id: equipmentId })
      .first();

    if (existing) {
      const [row] = await trx("cart_items")
        .where({ id: existing.id })
        .update({ quantity: existing.quantity + quantity })
        .returning("*");
      return row;
    }

    const [row] = await trx("cart_items")
      .insert({
        cart_id: cart.id,
        equipment_id: equipmentId,
        quantity,
      })
      .returning("*");
    return row;
  });
}

/**
 * Set quantity explicitly. Quantity 0 removes the row.
 */
async function setItemQuantity(userId, cartItemId, quantity) {
  return knex.transaction(async (trx) => {
    const cart = await getOrCreateCart(userId, trx);

    // Ensure the item belongs to the caller's cart.
    const item = await trx("cart_items")
      .where({ id: cartItemId, cart_id: cart.id })
      .first();
    if (!item) return null;

    if (quantity <= 0) {
      await trx("cart_items").where({ id: cartItemId }).del();
      return { removed: true };
    }

    const [row] = await trx("cart_items")
      .where({ id: cartItemId })
      .update({ quantity })
      .returning("*");
    return row;
  });
}

async function removeItem(userId, cartItemId) {
  const cart = await getOrCreateCart(userId);
  const count = await knex("cart_items")
    .where({ id: cartItemId, cart_id: cart.id })
    .del();
  return count > 0;
}

async function clearCart(userId, trx = knex) {
  const cart = await getOrCreateCart(userId, trx);
  await trx("cart_items").where({ cart_id: cart.id }).del();
  return cart;
}

module.exports = {
  getOrCreateCart,
  getCartWithItems,
  addItem,
  setItemQuantity,
  removeItem,
  clearCart,
};

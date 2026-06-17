const orderRepo = require("../repositories/order.repository");
const rentalRepo = require("../repositories/rental.repository");
const stripeService = require("../services/stripe.service");
const notificationService = require("../services/notification.service");
const knex = require("../db");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

/**
 * POST /orders
 * Create an order from the caller's cart.
 */
const create = asyncHandler(async (req, res) => {
  const {
    shipping_address,
    payment_method = "card",
    promo_code = null,
    loyalty_points = 0,
    shipping_fee = 0,
    notes = null,
  } = req.body;

  const result = await orderRepo.createOrderFromCart({
    userId: req.user.id,
    shippingAddress: shipping_address,
    paymentMethod: payment_method,
    promoCode: promo_code,
    loyaltyPointsRequested: loyalty_points,
    shippingFee: shipping_fee,
    notes,
  });

  // For card orders, create a PaymentIntent. For COD, the order waits in
  // pending until a delivery courier confirms handover (future phase).
  let payment = null;
  if (payment_method === "card") {
    const intent = await stripeService.createPaymentIntent({
      amount: result.order.total,
      orderId: result.order.id,
      userId: req.user.id,
    });
    payment = {
      client_secret: intent.clientSecret,
      payment_intent_id: intent.paymentIntentId,
      mock: intent.mock,
    };
    // Persist the PI id on the order
    result.order = await orderRepo.setPaymentIntent(
      result.order.id,
      intent.paymentIntentId,
    );
  }

  // Fire-and-forget notification that the order was received.
  notificationService.events
    .orderCreated(req.user.id, result.order)
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error("[order notify failed]", e.message);
    });

  // For COD orders: create the delivery request immediately (card orders get
  // their delivery request created inside markPaid via the Stripe webhook).
  if (payment_method === "cash_on_delivery") {
    (async () => {
      try {
        const firstItem = await knex("order_items as oi")
          .leftJoin("equipment as e", "e.id", "oi.equipment_id")
          .leftJoin("users as u", "u.id", "e.owner_id")
          .where("oi.order_id", result.order.id)
          .first(
            "u.location as owner_location",
            "u.governorate as owner_governorate",
            "u.name as owner_name",
          );

        const pickupAddress =
          firstItem && firstItem.owner_location
            ? typeof firstItem.owner_location === "string"
              ? JSON.parse(firstItem.owner_location)
              : firstItem.owner_location
            : {
                city: firstItem?.owner_governorate || "muscat",
                note: `استلام من البائع ${firstItem?.owner_name || ""}`.trim(),
              };

        const dropoffAddress =
          typeof result.order.shipping_address === "string"
            ? JSON.parse(result.order.shipping_address)
            : result.order.shipping_address || { city: "muscat" };

        const [deliveryRow] = await knex("delivery_requests")
          .insert({
            order_id: result.order.id,
            courier_id: null,
            status: "pending",
            pickup_address: JSON.stringify(pickupAddress),
            dropoff_address: JSON.stringify(dropoffAddress),
            scheduled_date: new Date().toISOString().slice(0, 10),
            fee: result.order.shipping_fee || 2.0,
          })
          .returning("*");

        if (deliveryRow) {
          notificationService.events
            .newDeliveryAvailable(deliveryRow, result.order.tracking_number)
            .catch((e) => {
              // eslint-disable-next-line no-console
              console.error("[newDeliveryAvailable COD notify failed]", e.message);
            });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[COD delivery request creation failed]", e.message);
      }
    })();
  }

  res.status(201).json({
    success: true,
    order: result.order,
    items: result.items,
    payment,
  });
});

/**
 * GET /orders/mine
 */
const listMine = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await orderRepo.listByUser(req.user.id, { page, limit });
  res.json({ success: true, ...result });
});

/**
 * GET /orders/:id
 * Owner of the order only.
 */
const getOne = asyncHandler(async (req, res) => {
  const order = await orderRepo.getByIdForUser(req.params.id, req.user.id);
  if (!order) throw new AppError("Order not found", 404);
  res.json({ success: true, order });
});

/**
 * GET /orders/track/:tracking
 * Public endpoint — supports both HRT- (sale) and IJ- (rental) tracking numbers.
 */
const track = asyncHandler(async (req, res) => {
  const { tracking } = req.params;
  if (tracking.startsWith("IJ-")) {
    const rental = await rentalRepo.getByTracking(tracking);
    if (!rental) throw new AppError("Rental not found", 404);
    return res.json({ success: true, type: "rental", rental });
  }
  const order = await orderRepo.getByTracking(tracking);
  if (!order) throw new AppError("Order not found", 404);
  res.json({ success: true, type: "order", order });
});

/**
 * GET /orders (admin)
 */
const listAll = asyncHandler(async (req, res) => {
  const { page, limit, status, payment_status } = req.query;
  const result = await orderRepo.listAll({
    page,
    limit,
    status,
    paymentStatus: payment_status,
  });
  res.json({ success: true, ...result });
});

module.exports = { create, listMine, getOne, track, listAll };

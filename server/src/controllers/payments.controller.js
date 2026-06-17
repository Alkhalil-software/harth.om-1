const orderRepo = require("../repositories/order.repository");
const stripeService = require("../services/stripe.service");
const notificationService = require("../services/notification.service");
const { asyncHandler } = require("../middleware/errorHandler");

/**
 * POST /payments/webhook
 *
 * Stripe calls this when a PaymentIntent succeeds or fails.
 * req.body MUST be a raw Buffer (set up in app.js with express.raw before
 * this route) so we can verify the Stripe signature.
 *
 * We return 200 quickly even for unknown event types so Stripe doesn't retry.
 */
const webhook = asyncHandler(async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const event = stripeService.verifyWebhook({
    rawBody: req.body, // Buffer
    signatureHeader: signature,
  });

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object;
      const order = await orderRepo.findByPaymentIntent(pi.id);
      if (order) {
        const paidOrder = await orderRepo.markPaid(order.id, {
          paymentIntentId: pi.id,
        });
        // Fire notification after successful state change. Fire-and-forget.
        notificationService.events.orderPaid(order.user_id, paidOrder).catch(
          (e) => {
            // eslint-disable-next-line no-console
            console.error("[orderPaid notify failed]", e.message);
          },
        );

        // Fan out to all couriers so they see the new available job. The
        // delivery_request was created inside markPaid in the same tx.
        const knex = require("../db");
        const delivery = await knex("delivery_requests")
          .where({ order_id: paidOrder.id })
          .first();
        if (delivery) {
          notificationService.events
            .newDeliveryAvailable(delivery, paidOrder.tracking_number)
            .catch((e) => {
              // eslint-disable-next-line no-console
              console.error("[newDeliveryAvailable notify failed]", e.message);
            });
        }
      }
      break;
    }
    case "payment_intent.payment_failed":
    case "payment_intent.canceled": {
      const pi = event.data.object;
      const order = await orderRepo.findByPaymentIntent(pi.id);
      if (order) {
        const failedOrder = await orderRepo.markFailed(order.id);
        if (failedOrder) {
          notificationService.events
            .orderFailed(order.user_id, failedOrder)
            .catch((e) => {
              // eslint-disable-next-line no-console
              console.error("[orderFailed notify failed]", e.message);
            });
        }
      }
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
});

module.exports = { webhook };

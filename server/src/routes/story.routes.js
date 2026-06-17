const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const { optionalAuth } = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const requireApprovedAccount = require("../middleware/requireApprovedAccount");
const ctrl = require("../controllers/story.controller");
const {
  createStoryValidator,
  storyIdValidator,
  authorIdValidator,
} = require("../validators/story.validator");

// ─── Public reads ──────────────────────────────────────────────────
// Anonymous-friendly. The homepage strip works for logged-out browsers.
router.get("/", ctrl.listLive);
router.get("/by-author/:authorId", authorIdValidator, ctrl.listByAuthor);

// View tracking accepts both authenticated and anonymous calls. We use
// optionalAuth so authenticated views are deduped per-user, anonymous
// ones per `x-anon-session` header.
router.post("/:id/view", optionalAuth, storyIdValidator, ctrl.recordView);

// ─── Authenticated writes ──────────────────────────────────────────
// Only owners/admins can publish. requireApprovedAccount blocks pending
// or rejected farmers from posting before the admin reviews them.
router.post(
  "/",
  auth,
  requireRole("owner", "admin"),
  requireApprovedAccount,
  createStoryValidator,
  ctrl.createStory,
);
router.delete("/:id", auth, storyIdValidator, ctrl.deleteStory);

// Author-only viewer breakdown.
router.get("/:id/viewers", auth, storyIdValidator, ctrl.listViewers);

module.exports = router;

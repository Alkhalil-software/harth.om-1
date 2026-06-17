const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const ctrl = require("../controllers/uploads.controller");

// Any authenticated user can upload images. Originally this was scoped to
// owner/admin/delivery (sellers + couriers needing equipment / proof
// images). KYC changed that — renters submitting KYC need to upload an
// ID front, ID back, and selfie. Rather than adding an unscoped "kyc
// upload" endpoint that does the same thing as this one with a different
// auth gate, we widen this to any authenticated user. Multer's per-file
// size limit and rate limiting (set globally on /api) keep abuse contained.

router.post("/image",  auth, upload.single("image"),       ctrl.uploadSingle);
router.post("/images", auth, upload.array("images", 10),   ctrl.uploadMultiple);
router.post("/pdf",    auth, upload.singlePdf("pdf"),       ctrl.uploadPdf);

module.exports = router;

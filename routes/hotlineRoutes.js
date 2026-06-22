const express = require("express");
const {
  getHotlines,
  createHotline,
  updateHotline,
  deleteHotline,
} = require("../controllers/hotlineController");
const router = express.Router();
// Route mappings
router.route("/").get(getHotlines).post(createHotline);
router.route("/:id").put(updateHotline).delete(deleteHotline);

// THIS MUST BE module.exports
module.exports = router;

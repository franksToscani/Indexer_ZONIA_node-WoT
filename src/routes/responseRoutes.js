const express = require("express");
const responseController = require("../controllers/responseController");

const router = express.Router();

router.get("/:requestId", responseController.getResponse);

module.exports = router;
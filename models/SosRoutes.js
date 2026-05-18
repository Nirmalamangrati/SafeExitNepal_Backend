const mongoose = require("mongoose");

const SOSEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    status: { type: String, default: "active" }, // active, resolved
  },
  { timestamps: true }, // यसले स्वतः createdAt र updatedAt थपिदिन्छ
);

module.exports = mongoose.model("SOSEvent", SOSEventSchema);

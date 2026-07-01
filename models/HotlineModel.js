const mongoose = require("mongoose");

const hotlineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    number: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: ["National", "Disaster", "Medical", "Security"],
    },
    icon: { type: String, required: true },
    description: { type: String, required: true },
  },
  { timestamps: true },
);

// Define model and export using CommonJS format
const Hotline = mongoose.model("Hotline", hotlineSchema);
module.exports = Hotline;

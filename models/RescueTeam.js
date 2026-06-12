const mongoose = require("mongoose");

const RescueTeamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    contact: { type: String, required: true },
    members: { type: Number, required: true },
    email: { type: String, default: "" },
    website: { type: String, default: "" },
    location: { type: String, required: true },
    status: { type: String, default: "Available" }, // Available, Unavailable, On the Way
    latitude: { type: Number, default: 27.7172 },
    longitude: { type: Number, default: 85.324 },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.RescueTeam || mongoose.model("RescueTeam", RescueTeamSchema);

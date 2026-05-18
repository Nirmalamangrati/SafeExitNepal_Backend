const mongoose = require("mongoose");

const IncidentSchema = new mongoose.Schema(
  {
    incidentCategory: { type: String, required: true }, // critical, high, medium, low
    incidentType: { type: String, required: true }, // fire, landslide, flood, other
    locationName: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    description: { type: String, required: true },
    status: { type: String, default: "pending" }, 
  },
  { timestamps: true }, 
);

module.exports = mongoose.model("Incident", IncidentSchema);

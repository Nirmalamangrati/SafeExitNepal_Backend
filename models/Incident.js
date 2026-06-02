const mongoose = require("mongoose");

const IncidentSchema = new mongoose.Schema(
  {
    incidentCategory: { type: String, required: true }, // critical, high, medium, low
    incidentType: { type: String, required: true }, // fire, landslide, flood, other
    incidentDate: { type: String, required: true }, // Mobile bata aako date string
    locationName: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    description: { type: String, required: true },
    status: { type: String, default: "PENDING" }, // PENDING, APPROVED, RESOLVED
    attachedFilePath: { type: String, default: "" }, // Attached image/file path

    // 1. Suspect Info Model Array Setup:
    suspectInfo: {
      name: { type: String, default: "" },
      age: { type: String, default: "" },
      gender: { type: String, default: "" },
      contact: { type: String, default: "" },
    },

    // 2. Reporter Info Data Setup:
    reporterInfo: {
      name: { type: String, default: "Anonymous" },
      yourName: { type: String, default: "Anonymous" },
      contact: { type: String, default: "" },
      isAnonymous: { type: Boolean, default: false },
    },
    //3. Rescue Team Info Data Setup:
    rescueTeamInfo: {
      teamName: { type: String, default: "" },
      contact: { type: String, default: "" },
      members: { type: String, default: "" },
      email: { type: String, default: "" },
      website: { type: String, default: "" },
      status: { type: String, default: "PENDING" },
      location: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.Incident || mongoose.model("Incident", IncidentSchema);

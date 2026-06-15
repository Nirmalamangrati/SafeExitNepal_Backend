const mongoose = require("mongoose");

const OfflineResourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Resource title is required"],
      trim: true,
    },
    resourceType: {
      type: String,
      default: "Map",
      enum: ["Map", "Guide", "Manual", "Procedure", "Image"],
      trim: true,
    },
    version: {
      type: String,
      default: "v1.0.0",
      trim: true,
    },
    size: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    localPath: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt fields
  },
);

module.exports = mongoose.model("OfflineResource", OfflineResourceSchema);

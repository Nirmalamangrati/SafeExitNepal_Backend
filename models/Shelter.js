const mongoose = require("mongoose");

const ShelterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    amenities: { type: String, default: "" },
    capacity: { type: String, default: "N/A" },
    status: { type: String, default: "Open" },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { timestamps: true },
);

// Format data for frontend (.id instead of ._id)
ShelterSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});

module.exports = mongoose.model("Shelter", ShelterSchema);

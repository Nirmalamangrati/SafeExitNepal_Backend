const mongoose = require("mongoose");

const ShelterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    amenities: { type: String, default: "" },
    capacity: { type: String, default: "N/A" },
    status: { type: String, default: "Open" },
    fulladdress: { type: String, default: "" },
    supervisorName: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    alternativePhone: { type: String, default: "" },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { timestamps: true },
);

ShelterSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject();
  object.id = _id;
  return object;
});

module.exports = mongoose.model("Shelter", ShelterSchema, "shelters");

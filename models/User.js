const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    gender: { type: String, default: "Male" },
    dob: { type: String, default: "" },

    // Array of objects for dynamic emergency contacts
    emergencyContacts: [
      {
        name: { type: String },
        relationship: { type: String },
        phone: { type: String },
        primary: { type: Boolean, default: false },
      },
    ],

    // Nested object for safety data
    safetyInfo: {
      bloodGroup: { type: String, default: "" },
      medicalConditions: { type: String, default: "" },
      allergies: { type: String, default: "" },
      address: { type: String, default: "" },
      hospital: { type: String, default: "" },
    },

    // Nested object for permissions layout
    permissions: {
      location: { type: Boolean, default: true },
      notifications: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      phone: { type: Boolean, default: true },
      background: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", UserSchema);

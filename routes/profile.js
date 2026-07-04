const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../models/User");
router.put("/update/:userId", async (req, res) => {
  const { userId } = req.params;
  const {
    fullName,
    phone,
    gender,
    dob,
    address,
    bloodGroup,
    emergencyContacts,
  } = req.body;
  try {
    let user = null;

    // Find user
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }
    if (!user && phone) {
      user = await User.findOne({ phone: phone.trim() });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check duplicate phone
    if (phone && phone.trim() !== user.phone) {
      const existingPhone = await User.findOne({
        phone: phone.trim(),
        _id: { $ne: user._id },
      });

      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: "Phone already exists",
        });
      }
    }

    // Update fields
    user.fullName = fullName?.trim() || user.fullName;
    user.phone = phone?.trim() || user.phone;
    user.gender = gender || user.gender;
    user.dob = dob || user.dob;

    // safety info
    user.safetyInfo = {
      ...user.safetyInfo,
      bloodGroup: bloodGroup || "Not Specified",
      address: address || "",
    };

    // emergency contacts
    if (emergencyContacts) {
      user.emergencyContacts = emergencyContacts;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
});

module.exports = router;

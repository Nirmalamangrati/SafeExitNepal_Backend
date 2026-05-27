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

    // 1. User check garne (Valid Mongoose ID ya Phone bata)
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }

    // ID le bhetena tara query ma phone cha bhane search garne
    if (!user && phone) {
      user = await User.findOne({ phone: phone.trim() });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Cannot update profile.",
      });
    }

    // 2. Phone change check ra unique check
    if (phone && phone.trim() !== user.phone) {
      const trimmedPhone = phone.trim();
      const phoneExists = await User.findOne({
        phone: trimmedPhone,
        _id: { $ne: user._id },
      });
      if (phoneExists) {
        return res.status(400).json({
          success: false,
          message: "This phone number is already registered by another user.",
        });
      }
      user.phone = trimmedPhone;
    }

    // 3. Dot notation use garera explicit fields update object tayar parne
    const updateFields = {};

    if (fullName !== undefined) updateFields.fullName = fullName.trim();
    if (gender !== undefined) updateFields.gender = gender;

    // Khali string filter garera clear default halne taaki database ma "Not Provided" text direct save nahos
    if (dob !== undefined) updateFields.dob = dob.trim() || "";
    if (phone !== undefined) updateFields.phone = phone.trim();

    // Mongoose Model nested format check (safely nested properties set garne)
    if (bloodGroup !== undefined) {
      updateFields["safetyInfo.bloodGroup"] =
        bloodGroup.trim() || "Not Specified";
    }
    if (address !== undefined) {
      updateFields["safetyInfo.address"] = address.trim() || "";
    }

    if (emergencyContacts !== undefined) {
      updateFields.emergencyContacts = emergencyContacts;
    }

    // 4. Update executing with findByIdAndUpdate
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: updateFields },
      { new: true, runValidators: true },
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully!",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

module.exports = router;

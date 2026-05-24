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

    // 1. User find garne (ID bata ya Phone bata)
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }
    if (!user && phone) {
      user = await User.findOne({ phone: phone.trim() });
    }

    // User bhettiyena bhane seedhai error dine (required fields nabhako le create garna mildaina)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Cannot update profile.",
      });
    }

    // 2. Phone Change garna khojda unique check garne
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

    // 3. Dot Notation use garera exact fields matra update garne object banaune
    // Yesle safetyInfo ka aru fields (allergies, medicalConditions) lai delete gardaina
    const updateFields = {};

    if (fullName !== undefined) updateFields.fullName = fullName.trim();
    if (gender !== undefined) updateFields.gender = gender;
    if (dob !== undefined) updateFields.dob = dob.trim();
    if (phone !== undefined) updateFields.phone = phone.trim();

    // Nested safetyInfo fields safe update
    if (bloodGroup !== undefined)
      updateFields["safetyInfo.bloodGroup"] = bloodGroup.trim();
    if (address !== undefined)
      updateFields["safetyInfo.address"] = address.trim();

    // Array field overwrite / update
    if (emergencyContacts !== undefined)
      updateFields.emergencyContacts = emergencyContacts;

    // 4. Finally Database Update garne
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

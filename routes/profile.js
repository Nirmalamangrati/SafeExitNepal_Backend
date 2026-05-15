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
    const cleanedPhone = phone ? phone.trim() : "";
    let user = null;

    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }
    if (!user && cleanedPhone) {
      user = await User.findOne({ phone: cleanedPhone });
    }
    const updateData = {
      fullName: fullName ? fullName.trim() : user ? user.fullName : "",
      phone: cleanedPhone || (user ? user.phone : ""),
      gender: gender || (user ? user.gender : "Male"),
      dob: dob ? dob.trim() : user ? user.dob : "",
      safetyInfo: {
        ...(user?.safetyInfo || {}),
        bloodGroup:
          bloodGroup !== undefined
            ? bloodGroup.trim()
            : user?.safetyInfo?.bloodGroup || "",
        address:
          address !== undefined
            ? address.trim()
            : user?.safetyInfo?.address || "",
      },

      emergencyContacts:
        emergencyContacts || (user ? user.emergencyContacts : []),
    };
    let updatedUser;
    if (user) {
      updatedUser = await User.findByIdAndUpdate(
        user._id,
        { $set: updateData },
        { new: true, runValidators: true },
      );
    } else {
      updatedUser = await User.create(updateData);
    }
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

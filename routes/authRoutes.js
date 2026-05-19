const express = require("express");
const router = require("express").Router();
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const twilio = require("twilio");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "safeexit_super_secret_key_123";

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: "Too many login attempts. Please try again after 15 minutes.",
  },
});

//  1. MAIN DISPATCH OTP ROUTE
router.post("/send-otp", loginRateLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Contact info and password are required." });
  }

  try {
    const cleanContact = email.trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { email: cleanContact },
        { phone: cleanContact },
        { phone: email.trim() },
      ],
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password." });
    }
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ error: "Invalid username or password." });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 300000;
    await user.save();
    console.log(
      `➔ [BACKEND CONTROL LOG] Generated OTP for ${user.fullName}: ${otp}`,
    );
    const isEmailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (isEmailFormat.test(cleanContact)) {
      await transporter.sendMail({
        from: '"SafeExit Nepal" <noreply@safeexit.com>',
        to: user.email,
        subject: "Your Login Verification Code",
        text: `Your verification code is: ${otp}.`,
      });
      return res
        .status(200)
        .json({ message: "OTP sent successfully to email!" });
    } else {
      const formattedPhone = user.phone.startsWith("+977")
        ? user.phone
        : `+977${user.phone}`;

      if (twilioClient) {
        try {
          await twilioClient.messages.create({
            body: `SafeExit Nepal: Your verification code is ${otp}.`,
            to: formattedPhone,
            from: process.env.TWILIO_PHONE_NUMBER,
          });
          return res
            .status(200)
            .json({ message: "Real SMS sent successfully!" });
        } catch (twilioError) {
          console.log(
            `➔ [TELECOM CARRIER REFUSAL BYPASS] Gateway blocked. Code printed above.`,
          );
          return res.status(200).json({
            message:
              "Sandbox development bypass active. Please read code from terminal logs.",
            otp: otp,
            contact: email,
          });
        }
      } else {
        return res
          .status(200)
          .json({ message: "Test mode simulation fallback active.", otp });
      }
    }
  } catch (error) {
    console.error("Backend Login Error:", error);
    res.status(500).json({ error: "Internal server error during login." });
  }
});

//  2. VERIFY OTP ROUTE
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: "Contact and OTP are required." });
  }

  try {
    const cleanContact = email.trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { email: cleanContact },
        { phone: cleanContact },
        { phone: email.trim() },
      ],
    });

    if (
      !user ||
      !user.otp ||
      Date.now() > new Date(user.otpExpires).getTime()
    ) {
      return res
        .status(400)
        .json({ error: "OTP code has expired. Please request a new one." });
    }

    if (user.otp.toString() !== otp.toString()) {
      return res.status(400).json({ error: "Incorrect verification code." });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" },
    );
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    console.log(
      `[VERIFY SUCCESS] User ${user.fullName} logged in successfully.`,
    );
    return res.status(200).json({
      message: "Login verified successfully!",
      token,
      user: { fullName: user.fullName, email: user.email, phone: user.phone },
    });
  } catch (error) {
    console.error(" [VERIFY OTP ERROR]:", error);
    return res.status(500).json({ error: "Server error during verification." });
  }
});

//  3. RESEND OTP ROUTE
router.post("/resend-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Contact info is required." });
  }

  try {
    const cleanContact = email.trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { email: cleanContact },
        { phone: cleanContact },
        { phone: email.trim() },
      ],
    });
    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 300000;
    await user.save();
    console.log(`➔ [BACKEND RESEND LOG] New OTP for ${user.fullName}: ${otp}`);
    const isEmailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (isEmailFormat.test(cleanContact)) {
      await transporter.sendMail({
        from: '"SafeExit Nepal" <noreply@safeexit.com>',
        to: user.email,
        subject: "Your New Login Verification Code",
        text: `Your new verification code is: ${otp}.`,
      });
      return res
        .status(200)
        .json({ message: "New OTP sent successfully to your email!" });
    } else {
      const formattedPhone = user.phone.startsWith("+977")
        ? user.phone
        : `+977${user.phone}`;

      if (twilioClient) {
        try {
          await twilioClient.messages.create({
            body: `SafeExit Nepal: Your new verification code is ${otp}.`,
            to: formattedPhone,
            from: process.env.TWILIO_PHONE_NUMBER,
          });
          return res
            .status(200)
            .json({ message: "Real OTP SMS has been resent to your phone!" });
        } catch (twilioError) {
          console.log(
            "➔ [RESEND BYPASS ACTIVE] Forwarding mock success status to frontend client app layers.",
          );
          return res.status(200).json({
            message: "New OTP generated successfully (Sandbox Bypass Active).",
            otp: otp,
            contact: email,
          });
        }
      } else {
        return res.status(200).json({
          message: "Test mode simulation resend fallback active.",
          otp,
        });
      }
    }
  } catch (error) {
    console.error("Backend Resend Error:", error);
    res.status(500).json({ error: "Internal server error during resend." });
  }
});

module.exports = router;

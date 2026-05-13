const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const User = require("../models/User"); // Path to your User Mongoose Model

// Setup Nodemailer Transporter for Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
//1. ALGORITHM: LEAKY/TOKEN BUCKET (RATE LIMITING)
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 5, // Limit each IP to 5 login requests per window
  message: {
    error: "Too many login attempts. Please try again after 15 minutes.",
  },
});

// LOGIN & SEND OTP ROUTE
router.post("/send-otp", loginRateLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    //2. ALGORITHM: BCRYPT CRYPTOGRAPHIC PASSWORD HASHING
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Generate a secure 6-digit random number token for OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Update user document with the generated OTP and a 5-minute expiration timestamp
    await User.findOneAndUpdate(
      { email },
      { otp, otpExpires: Date.now() + 300000 }, // 300,000 ms = 5 minutes
    );

    // Dispatching the generated token via Nodemailer SMTP service
    await transporter.sendMail({
      from: '"SafeExit Nepal" <noreply@safeexit.com>',
      to: email,
      subject: "Your Login Verification Code",
      text: `Your verification code is: ${otp}. It will expire in 5 minutes.`,
    });

    res.status(200).json({ message: "OTP sent successfully to your email!" });
  } catch (error) {
    console.error("Backend Login Error:", error);
    res.status(500).json({ error: "Internal server error during login." });
  }
});

module.exports = router;

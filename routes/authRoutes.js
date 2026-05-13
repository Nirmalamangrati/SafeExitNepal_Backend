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

const signupRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 3,
  message: {
    error: "Too many signup attempts. Please try again after 30 minutes.",
  },
});

const signupPasswordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

//  LOGIN & SEND OTP

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
      $or: [{ email: cleanContact }, { phone: email.trim() }],
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

    console.log(`➔ [BACKEND LOG] Generated OTP for ${user.fullName}: ${otp}`);

    const isEmailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (isEmailFormat.test(cleanContact)) {
      await transporter.sendMail({
        from: '"SafeExit Nepal" <noreply@safeexit.com>',
        to: user.email,
        subject: "Your Login Verification Code",
        text: `Your verification code is: ${otp}. It will expire in 5 minutes.`,
      });
      return res
        .status(200)
        .json({ message: "OTP sent successfully to your email!" });
    } else {
      const formattedPhone = user.phone.startsWith("+")
        ? user.phone
        : `+977${user.phone}`;

      if (twilioClient) {
        await twilioClient.messages.create({
          body: `SafeExit Nepal: Your verification code is ${otp}. Valid for 5 mins.`,
          to: formattedPhone,
          from: process.env.TWILIO_PHONE_NUMBER,
        });
        return res
          .status(200)
          .json({ message: "Real OTP SMS has been sent to your phone!" });
      } else {
        console.log(
          ` [TEST MODE] Twilio configuration missing. Simulated OTP Code: ${otp}`,
        );
        return res.status(200).json({
          message: `[TEST MODE] Real SMS gateway not set. Your OTP code is ${otp}`,
          otp,
        });
      }
    }
  } catch (error) {
    console.error("Backend Login Error:", error);
    res.status(500).json({ error: "Internal server error during login." });
  }
});
//  VERIFY OTP & INSTANTIATE SESSION (JWT)

router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ error: "Contact and OTP are required." });
  }

  try {
    const cleanContact = email.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: cleanContact }, { phone: email.trim() }],
    });

    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    if (!user.otp || Date.now() > user.otpExpires) {
      return res
        .status(400)
        .json({ error: "OTP code has expired. Please request a new one." });
    }

    if (user.otp !== otp) {
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

//  SIGNUP ROUTE

router.post("/signup", signupRateLimiter, async (req, res) => {
  console.log("➔ [BACKEND LOG] Signup request received!", req.body);

  const {
    fullName,
    phone,
    email,
    password,
    gender,
    dob,
    emergencyContacts,
    safetyInfo,
    permissions,
  } = req.body;

  if (!fullName || !phone || !email || !password) {
    return res.status(400).json({ error: "Required fields are missing." });
  }

  if (!signupPasswordRegex.test(password)) {
    return res.status(400).json({
      error:
        "Password must be 8+ characters with 1 uppercase, 1 lowercase, 1 number, and 1 special symbol.",
    });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const userExists = await User.findOne({
      $or: [{ email: cleanEmail }, { phone: phone.trim() }],
    });
    if (userExists) {
      return res
        .status(400)
        .json({ error: "Email or Phone Number is already registered." });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = new User({
      fullName,
      phone: phone.trim(),
      email: cleanEmail,
      password: hashedPassword,
      gender,
      dob,
      emergencyContacts: emergencyContacts || [],
      safetyInfo: safetyInfo || {},
      permissions: permissions || {},
    });

    await newUser.save();
    console.log("➔ [BACKEND LOG] User account safely saved!");

    return res.status(201).json({ message: "Account created successfully!" });
  } catch (error) {
    console.error(" [MONGOOSE SIGNUP ERROR]:", error);
    return res
      .status(500)
      .json({ error: "Database exception: " + error.message });
  }
});

module.exports = router;

const User = require("../models/User");
const bcrypt = require("bcryptjs");

exports.signup = async (req, res) => {
  try {
    // frontend bata aayeko data destructure garne
    const {
      fullName,
      email,
      phone,
      password,
      gender,
      dob,
      emergencyContacts,
      safetyInfo,
      permissions,
      fcmToken,
    } = req.body;

    // email or phone number paile register bhayeko xa ki nai check garne
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "Email or Phone already registered." });
    }

    //password hashing garne
    const hashedPassword = await bcrypt.hash(password, 10);

    //sabai data milayera schema anusar user object banayera database ma save garne
    const newUser = new User({
      fullName,
      email,
      phone,
      password: hashedPassword,
      gender,
      dob,
      emergencyContacts,
      safetyInfo,
      permissions,
      fcmToken,
    });
    //database save garne
    await newUser.save();
    res.status(201).json({ message: "User registered successfully!" });
  } catch (err) {
    console.error("Signup Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

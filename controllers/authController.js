const User = require("../models/User");
const bcrypt = require("bcryptjs");

exports.signup = async (req, res) => {
  try {
    const { contact, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ contact, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: "User registered successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

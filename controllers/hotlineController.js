const mongoose = require("mongoose");
const Hotline = require("../models/HotlineModel");
// @desc    Get all hotlines (GET)
// @route   GET /api/hotlines
const getHotlines = async (req, res) => {
  try {
    // Sorts by newest records first
    const hotlines = await Hotline.find({}).sort({ createdAt: -1 });
    res.status(200).json(hotlines);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch records", error: error.message });
  }
};

// @desc    Create a new hotline (POST)
// @route   POST /api/hotlines
const createHotline = async (req, res) => {
  const { name, number, category, icon, description } = req.body;

  if (!name || !number || !category || !icon || !description) {
    return res.status(400).json({ message: "Please fill all input fields" });
  }

  try {
    const newHotline = new Hotline({
      name,
      number,
      category,
      icon,
      description,
    });
    const savedHotline = await newHotline.save();
    res.status(201).json(savedHotline);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to save record", error: error.message });
  }
};

// @desc    Update an existing hotline (PUT)
// @route   PUT /api/hotlines/:id
const updateHotline = async (req, res) => {
  const { name, number, category, icon, description } = req.body;

  // Validate MongoDB Hex ID structure before processing
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res
      .status(400)
      .json({ message: "Invalid ID format sent from client" });
  }

  try {
    const hotline = await Hotline.findById(req.params.id);

    if (!hotline) {
      return res
        .status(404)
        .json({ message: "Emergency hotline record not found" });
    }

    hotline.name = name || hotline.name;
    hotline.number = number || hotline.number;
    hotline.category = category || hotline.category;
    hotline.icon = icon || hotline.icon;
    hotline.description = description || hotline.description;

    const updatedHotline = await hotline.save();
    res.status(200).json(updatedHotline);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update record", error: error.message });
  }
};

// @desc    Permanently delete a hotline (DELETE)
// @route   DELETE /api/hotlines/:id
const deleteHotline = async (req, res) => {
  // Validate MongoDB Hex ID structure before processing
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res
      .status(400)
      .json({ message: "Invalid ID format sent from client" });
  }

  try {
    const hotline = await Hotline.findById(req.params.id);

    if (!hotline) {
      return res
        .status(404)
        .json({ message: "Emergency hotline record not found" });
    }

    await Hotline.findByIdAndDelete(req.params.id);
    res
      .status(200)
      .json({ message: "Record successfully removed from database" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete record", error: error.message });
  }
};

// Exporting functions using CommonJS structure
module.exports = {
  getHotlines,
  createHotline,
  updateHotline,
  deleteHotline,
};

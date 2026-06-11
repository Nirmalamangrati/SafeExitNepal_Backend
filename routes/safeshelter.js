const express = require("express");
const router = express.Router();
const Shelter = require("../models/Shelter");

// Helper फङ्सन: सबै कनेक्टेड युजर्सलाई म्यापमा रियल-टाइम लिस्ट अपडेट पठाउने
const broadcastShelterList = async (io) => {
  try {
    const updatedList = await Shelter.find({});
    io.emit("SHELTER_LIST_UPDATED", updatedList);
  } catch (error) {
    console.error("Socket broadcast failed:", error);
  }
};

// मेन मोड्युल: यसले (io) इन्स्टान्स लिन्छ र एक्सप्रेस राउटर रिर्टन गर्छ
module.exports = function (io) {
  // ==========================================
  // १. REAL-TIME SOCKET.IO ENGINE LISTENERS
  // ==========================================
  io.on("connection", (socket) => {
    // १) पेज लोड हुँदा सबै डाटा माग्ने इभेन्ट
    socket.on("GET_ALL_SHELTERS", async () => {
      try {
        const allShelters = await Shelter.find({});
        socket.emit("SHELTER_LIST_UPDATED", allShelters);
      } catch (error) {
        console.error("Error fetching shelters via socket:", error);
      }
    });

    // २) नयाँ शेल्टर थप्ने इभेन्ट (सबै नयाँ फिल्डहरू यहाँ सेभ हुन्छन्)
    socket.on("ADD_SHELTER", async (shelterData) => {
      try {
        console.log("--> ADD_SHELTER इभेन्ट आयो! डाटा:", shelterData);

        const newShelter = new Shelter(shelterData);
        await newShelter.save();

        console.log(` Shelter Added via Socket: ${shelterData.name}`);
        await broadcastShelterList(io); // सबैलाई रियल-टाइम अपडेट पठाएको
      } catch (error) {
        console.error("Socket ADD_SHELTER error:", error);
      }
    });

    // ३) शेल्टर एडिट गर्ने इभेन्ट (सबै नयाँ फिल्डहरू यहाँ अपडेट हुन्छन्)
    socket.on("EDIT_SHELTER", async (data) => {
      try {
        const { id, ...shelterData } = data;
        await Shelter.findByIdAndUpdate(id, shelterData, { new: true });
        console.log(` Shelter Edited via Socket ID: ${id}`);

        await broadcastShelterList(io);
      } catch (error) {
        console.error("Socket EDIT_SHELTER error:", error);
      }
    });

    // ४) शेल्टर हटाउने इभेन्ट
    socket.on("DELETE_SHELTER", async (data) => {
      try {
        const { id } = data;
        await Shelter.findByIdAndDelete(id);
        console.log(` Shelter Deleted via Socket ID: ${id}`);

        await broadcastShelterList(io);
      } catch (error) {
        console.error("Socket DELETE_SHELTER error:", error);
      }
    });
  });

  // ==========================================
  // २. STANDARD HTTP EXPRESS ROUTES
  // ==========================================
  router.get("/", async (req, res) => {
    try {
      const shelters = await Shelter.find({});
      res.json(shelters);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  return router;
};

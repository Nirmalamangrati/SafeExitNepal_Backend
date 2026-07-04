const express = require("express");
const router = express.Router();
const Shelter = require("../models/Shelter");
const broadcastShelterList = async (io) => {
  try {
    const updatedList = await Shelter.find({});
    io.emit("SHELTER_LIST_UPDATED", updatedList);
  } catch (error) {
    console.error("Socket broadcast failed:", error);
  }
};
module.exports = function (io) {
  // 1. REAL-TIME SOCKET.IO ENGINE LISTENERS
  io.on("connection", (socket) => {
    socket.on("GET_ALL_SHELTERS", async () => {
      try {
        const allShelters = await Shelter.find({});
        socket.emit("SHELTER_LIST_UPDATED", allShelters);
      } catch (error) {
        console.error("Error fetching shelters via socket:", error);
      }
    });

    // 2. add shelter
    socket.on("ADD_SHELTER", async (shelterData) => {
      try {
        const newShelter = new Shelter(shelterData);
        await newShelter.save();
        console.log(` Shelter Added via Socket: ${shelterData.name}`);
        await broadcastShelterList(io);
      } catch (error) {
        console.error("Socket ADD_SHELTER error:", error);
      }
    });

    // 3. edit shelter
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

    // 4. delete shelter
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

  // 2. STANDARD HTTP EXPRESS ROUTES

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

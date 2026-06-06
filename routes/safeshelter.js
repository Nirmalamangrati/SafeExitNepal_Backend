const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const Shelter = require("../models/Shelter");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

// Initialize Socket.io on port 8000
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Connect to MongoDB Database
mongoose
  .connect("mongodb://127.0.0.1:27017/crisis_management")
  .then(() => console.log("MongoDB connected successfully."))
  .catch((err) => console.error("Database connection error:", err));

// Helper function to fetch and broadcast latest shelters to everyone
const broadcastShelterList = async () => {
  try {
    const rawShelters = await Shelter.find();
    // Convert Mongoose documents into clean JSON arrays with custom structural .id formatting
    const formattedShelters = rawShelters.map((s) => s.toJSON());

    // Broadcast real-time live events to the React hook listener pipeline
    io.emit("SHELTER_LIST_UPDATED", formattedShelters);
  } catch (error) {
    console.error("Failed to broadcast updated shelter dataset:", error);
  }
};

// Handle WebSocket client lifecycle pipelines
io.on("connection", async (socket) => {
  console.log(`User connected to live sync: ${socket.id}`);

  // Send the current list immediately when a user opens the application
  try {
    const rawShelters = await Shelter.find();
    socket.emit(
      "SHELTER_LIST_UPDATED",
      rawShelters.map((s) => s.toJSON()),
    );
  } catch (err) {
    console.error("Error sending initial shelter array data:", err);
  }

  // EVENT 1: Handle adding a new shelter record
  socket.on("ADD_SHELTER", async (shelterData) => {
    try {
      console.log("Receiving new safe zone payload registration:", shelterData);

      const newShelter = new Shelter({
        name: shelterData.name,
        amenities: shelterData.amenities,
        capacity: shelterData.capacity,
        status: shelterData.status,
        lat: shelterData.lat,
        lng: shelterData.lng,
      });

      await newShelter.save();
      console.log("New safe shelter entry published safely.");

      // Update the frontend application globally
      await broadcastShelterList();
    } catch (err) {
      console.error("Failed to save shelter registration:", err);
    }
  });

  // EVENT 2: Handle editing existing parameters
  socket.on("EDIT_SHELTER", async (updatePayload) => {
    try {
      console.log("Receiving parameter modifications request:", updatePayload);
      const { id, ...updatedFields } = updatePayload;

      const updatedRecord = await Shelter.findByIdAndUpdate(
        id,
        { $set: updatedFields },
        { new: true }, // Returns the modified document
      );

      if (updatedRecord) {
        console.log(`Shelter configuration updated successfully.`);
        await broadcastShelterList();
      } else {
        console.log(`Shelter ID tracking profile match not found.`);
      }
    } catch (err) {
      console.error(
        "Failed processing parameters modification event loop:",
        err,
      );
    }
  });

  // EVENT 3: Handle deleting a safe zone instance
  socket.on("DELETE_SHELTER", async (deletePayload) => {
    try {
      console.log(
        `Receiving destruction request line for shelter profile ID: ${deletePayload.id}`,
      );

      await Shelter.findByIdAndDelete(deletePayload.id);
      console.log("Target active zone destroyed successfully.");

      await broadcastShelterList();
    } catch (err) {
      console.error(
        "Failed processing target database removal loop sequence:",
        err,
      );
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected from sync cycle: ${socket.id}`);
  });
});

const PORT = 8000;
server.listen(PORT, () => {
  console.log(
    `Crisis communications backend cluster online at http://localhost:${PORT}`,
  );
});

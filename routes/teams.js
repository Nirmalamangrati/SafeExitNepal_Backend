const express = require("express");
const router = express.Router();
const axios = require("axios");
const RescueTeam = require("../models/RescueTeam");
const kalmanStates = {};
function initKalmanState() {
  return { q: 0.00001, r: 0.001, x: null, y: null, p: 1.0 };
}
function applyKalmanFilter(teamId, measuredLat, measuredLng) {
  if (!kalmanStates[teamId]) {
    kalmanStates[teamId] = initKalmanState();
    kalmanStates[teamId].x = measuredLat;
    kalmanStates[teamId].y = measuredLng;
    return { lat: measuredLat, lng: measuredLng };
  }
  const state = kalmanStates[teamId];
  state.p = state.p + state.q;
  const k = state.p / (state.p + state.r);
  state.x = state.x + k * (measuredLat - state.x);
  state.y = state.y + k * (measuredLng - state.y);
  state.p = (1 - k) * state.p;
  return { lat: state.x, lng: state.y };
}
function getHaversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 1. GET ALL TEAMS FROM THE NEW SEPARATE COLLECTION
router.get("/", async (req, res) => {
  try {
    const { userLat, userLng } = req.query;
    // Fetch directly from the pure RescueTeam table
    const activeTeams = await RescueTeam.find().sort({ createdAt: -1 });
    const formattedTeams = activeTeams.map((team) => {
      const filteredLoc = applyKalmanFilter(
        team._id.toString(),
        team.latitude || 27.7172,
        team.longitude || 85.324,
      );
      let straightDistance = Infinity;
      if (userLat && userLng) {
        straightDistance = getHaversineDistance(
          parseFloat(userLat),
          parseFloat(userLng),
          filteredLoc.lat,
          filteredLoc.lng,
        );
      }
      return {
        _id: team._id,
        id: team._id,
        name: team.name,
        contact: team.contact,
        members: String(team.members),
        crew: String(team.members),
        email: team.email,
        website: team.website,
        status: team.status,
        location: team.location,
        locationName: team.location,
        distanceFromMe:
          straightDistance !== Infinity
            ? straightDistance.toFixed(2) + " km"
            : "N/A",
        straightDistanceNum: straightDistance,
        latitude: filteredLoc.lat,
        longitude: filteredLoc.lng,
      };
    });
    if (userLat && userLng) {
      formattedTeams.sort(
        (a, b) => a.straightDistanceNum - b.straightDistanceNum,
      );
    }
    return res.status(200).json(formattedTeams);
  } catch (error) {
    console.error("GET Teams Error:", error);
    return res.status(500).json({ message: error.message });
  }
});

// 2. REGISTER/ADD NEW TEAM (POST)
router.post("/", async (req, res) => {
  try {
    const {
      name,
      contact,
      members,
      email,
      website,
      location,
      latitude,
      longitude,
    } = req.body;
    if (!name || !contact || !members || !location) {
      return res.status(400).json({ message: "Required fields are missing." });
    }
    const setLat = latitude || 27.7172;
    const setLng = longitude || 85.324;
    const newTeam = new RescueTeam({
      name,
      contact,
      members: Number(members),
      email: email || "",
      website: website || "",
      location,
      status: "Available",
      latitude: setLat,
      longitude: setLng,
    });
    const saved = await newTeam.save();
    const formattedTeam = {
      _id: saved._id,
      id: saved._id,
      name: saved.name,
      contact: saved.contact,
      members: String(saved.members),
      crew: String(saved.members),
      email: saved.email,
      website: saved.website,
      status: saved.status,
      location: saved.location,
      locationName: saved.location,
      latitude: setLat,
      longitude: setLng,
    };
    const io = req.app.get("io");
    if (io) {
      io.emit("team-added-or-updated", formattedTeam);
    }
    return res.status(201).json(formattedTeam);
  } catch (error) {
    console.error("Post Error on Teams Router:", error);
    return res.status(500).json({ message: error.message });
  }
});

// 3. EDIT TEAM (PUT)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      contact,
      members,
      email,
      website,
      status,
      location,
      latitude,
      longitude,
    } = req.body;
    const setLat = latitude || 27.7172;
    const setLng = longitude || 85.324;
    const updated = await RescueTeam.findByIdAndUpdate(
      id,
      {
        $set: {
          name,
          contact: String(contact),
          members: Number(members),
          email: email || "",
          website: website || "",
          status: status || "Available",
          location: String(location),
          latitude: setLat,
          longitude: setLng,
        },
      },
      { new: true },
    );
    if (!updated)
      return res.status(404).json({ message: "Rescue team not found." });
    const formattedUpdatedTeam = {
      _id: updated._id,
      id: updated._id,
      name: updated.name,
      contact: updated.contact,
      members: String(updated.members),
      crew: String(updated.members),
      email: updated.email,
      website: updated.website,
      status: updated.status,
      location: updated.location,
      locationName: updated.location,
      latitude: setLat,
      longitude: setLng,
    };

    const io = req.app.get("io");
    if (io) {
      io.emit("team-added-or-updated", formattedUpdatedTeam);
    }
    return res.status(200).json(formattedUpdatedTeam);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// 4. UPDATE STATUS (PATCH)
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await RescueTeam.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true },
    );

    if (!updated)
      return res.status(404).json({ message: "Rescue team not found." });

    const io = req.app.get("io");
    if (io) {
      io.emit("team-added-or-updated", {
        _id: updated._id,
        id: updated._id,
        status: updated.status,
      });
    }
    return res.status(200).json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// 5. DELETE TEAM
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await RescueTeam.findByIdAndDelete(id);
    if (!deleted)
      return res.status(404).json({ message: "Team record not found." });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;

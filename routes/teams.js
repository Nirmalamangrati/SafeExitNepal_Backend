const express = require("express");
const router = express.Router();
const Incident = require("../models/Incident");

// 0. FETCH ALL TEAMS (GET)
router.get("/", async (req, res) => {
  try {
    const { reporterName } = req.query;

    const teamsWithIncidents = await Incident.find({
      rescueTeamInfo: { $exists: true, $ne: null },
    }).sort({ createdAt: -1 });

    const formattedTeams = [];

    teamsWithIncidents.forEach((doc) => {
      const info = doc.rescueTeamInfo || {};
      const currentStatus = info.status || "Available";

      //  algorithm: if On the Way ho &  रिपोर्टर म्याच हुँदैन भने अरूलाई लुकाउने
      if (currentStatus === "On the Way") {
        const docReporter = doc.reporterInfo ? doc.reporterInfo.yourName : "";
        if (docReporter !== reporterName) return;
      }

      formattedTeams.push({
        _id: doc._id,
        id: doc._id,
        name: info.teamName || "Rescue Team",
        contact: info.contact || "N/A",
        members: info.members || "0",
        email: info.email || "",
        website: info.website || "",
        status: currentStatus,
        location: info.location || "N/A",
        // लाइभ ट्र्याकिङका लागि हालको को-अर्डिनेटहरू
        latitude: doc.latitude || 27.7172,
        longitude: doc.longitude || 85.324,
        // पीडित आफैँ उभिएको लोकेसन (घटना घटेको ठाउँ)
        clientLatitude: doc.latitude || 27.7172,
        clientLongitude: doc.longitude || 85.324,
      });
    });

    return res.status(200).json(formattedTeams);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 1. UPDATE TEAM STATUS (PATCH)
// URL: http://192.168.43/:id/status
// ==========================================
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status)
      return res.status(400).json({ message: "Status field is required." });
    const updated = await Incident.findByIdAndUpdate(
      id,
      { $set: { "rescueTeamInfo.status": status } },
      { new: true },
    );
    if (!updated)
      return res.status(404).json({ message: "Rescue team not found." });
    return res.status(200).json({
      message: "Status updated successfully",
      team: { id: updated._id, status: updated.rescueTeamInfo.status },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 2. DELETE TEAM (DELETE)
// URL: http://192.168.43/:id
// ==========================================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Incident.findByIdAndDelete(id);
    if (!deleted)
      return res.status(404).json({ message: "Rescue team not found." });
    return res.status(200).json({ message: "Team deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// ==========================================
// 3. REGISTER/ADD NEW TEAM (POST)
// URL: http://192.168.43
// ==========================================
router.post("/", async (req, res) => {
  try {
    const { name, contact, members, email, website, status, location } =
      req.body;

    if (!name || !contact || !members || !location) {
      return res.status(400).json({ message: "Required fields are missing." });
    }

    const newTeamIncident = new Incident({
      incidentCategory: "low",
      incidentType: "other",
      incidentDate: String(Date.now()),
      locationName: String(location),
      latitude: 27.7172,
      longitude: 85.324,
      description: "Rescue Team Auto Registration Stack Process",
      rescueTeamInfo: {
        teamName: name, // 👈 ब्याकेन्ड स्किमा अनुसार 'teamName'
        name: name, // 👈 सेफ गार्डका लागि 'name' पनि थपिदिएको
        contact: String(contact),
        members: String(members),
        email: email || "",
        website: website || "",
        status: status || "Available",
        location: String(location),
      },
    });

    const saved = await newTeamIncident.save();

    return res.status(201).json({
      _id: saved._id,
      id: saved._id,
      name: saved.rescueTeamInfo.teamName || saved.rescueTeamInfo.name,
      contact: saved.rescueTeamInfo.contact,
      members: saved.rescueTeamInfo.members,
      email: saved.rescueTeamInfo.email,
      website: saved.rescueTeamInfo.website,
      status: saved.rescueTeamInfo.status,
      location: saved.rescueTeamInfo.location,
    });
  } catch (error) {
    console.error("Post Error on Teams Router:", error);
    return res.status(500).json({ message: error.message });
  }
});

// 4. UPDATE WHOLE TEAM / EDIT (PUT)
// URL: http://192.168.43/:id
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact, members, email, website, status, location } =
      req.body;

    const updated = await Incident.findByIdAndUpdate(
      id,
      {
        $set: {
          locationName: String(location),
          "rescueTeamInfo.teamName": name,
          "rescueTeamInfo.contact": String(contact),
          "rescueTeamInfo.members": String(members),
          "rescueTeamInfo.email": email || "",
          "rescueTeamInfo.website": website || "",
          "rescueTeamInfo.status": status || "Available",
          "rescueTeamInfo.location": String(location),
        },
      },
      { new: true },
    );

    if (!updated)
      return res.status(404).json({ message: "Rescue team not found." });

    return res.status(200).json({
      _id: updated._id,
      id: updated._id,
      name: updated.rescueTeamInfo.teamName,
      contact: updated.rescueTeamInfo.contact,
      members: updated.rescueTeamInfo.members,
      email: updated.rescueTeamInfo.email,
      website: updated.rescueTeamInfo.website,
      status: updated.rescueTeamInfo.status,
      location: updated.rescueTeamInfo.location,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;

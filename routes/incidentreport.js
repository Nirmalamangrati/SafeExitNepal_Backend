const express = require("express");
const router = (reportFilterRouter = express.Router());
const Incident = require("../models/Incident");
const { kmeans } = require("ml-kmeans");
const multer = require("multer");
const path = require("path");
const REPORT_THRESHOLD = 2;

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// K-Means Clustering & Threshold Detection Function
async function runClusteringAndDetection(io) {
  try {
    const recentIncidents = await Incident.find({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    if (!recentIncidents || recentIncidents.length < 3) return;
    const dataPoints = recentIncidents.map((inc) => [
      inc.latitude,
      inc.longitude,
    ]);
    const K = Math.max(2, Math.floor(recentIncidents.length / 3));
    const ans = kmeans(dataPoints, K, { initialization: "kmeans++" });
    const clusters = Array.from({ length: K }, () => []);
    ans.clusters.forEach((clusterIndex, dataIndex) => {
      clusters[clusterIndex].push(recentIncidents[dataIndex]);
    });
    clusters.forEach((clusterReports, index) => {
      if (clusterReports.length >= REPORT_THRESHOLD) {
        const center = ans.centroids[index];

        io.emit("high-density-crisis", {
          clusterId: index,
          latitude: center[0],
          longitude: center[1],
          totalReports: clusterReports.length,
          message: ` Warning: ${clusterReports.length} incidents have been reported in this area recently!`,
        });
      }
    });
  } catch (err) {
    console.error("Clustering Error:", err);
  }
}
// Description read garera Priority Category xuttaune NLP function
function classifyIncidentPriority(description) {
  if (!description) return "low"; // kei navaye samanya manne
  const text = description.toLowerCase();

  // 1.  (Critical Keywords)
  const criticalWords = [
    "बचाउ",
    "बचाउनुहोस्",
    "फसे",
    "अड्किए",
    "रगत",
    "हस्पिटल",
    "घाइते",
    "मुटु",
    "help",
    "earthquake",
    "blood",
    "trapped",
    "bachaunuhos",
    "critical",
    "die",
    "injured",
    "hospital",
  ];

  // 2. (High Keywords)
  const highWords = [
    "बाढी",
    "पहिरो",
    "आगो",
    "भत्कियो",
    "विस्फोट",
    "flood",
    "landslide",
    "fire",
    "collapse",
    "injury",
    "cylinder",
  ];

  // 3.(Medium Keywords)
  const mediumWords = [
    "बाटो बन्द",
    "अवरोध",
    "Blocked",
    "road close",
    "water log",
    "tree fall",
    "accident",
    "जाम",
    "थुनियो",
  ];

  // AI checking logic
  if (criticalWords.some((word) => text.includes(word))) return "critical";
  if (highWords.some((word) => text.includes(word))) return "high";
  if (mediumWords.some((word) => text.includes(word))) return "medium";

  return "low";
}

module.exports = (io) => {
  // 1. REFRESH LOGIC: Admin panel refresh huda sabai incidents list pathaune GET API
  router.get("/", async (req, res) => {
    try {
      const allIncidents = await Incident.find().sort({ createdAt: -1 });
      res.json(allIncidents);
    } catch (error) {
      console.error("Fetch All Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 2. PATCH API for updating incident status from admin panel (PENDING → APPROVED/RESOLVED)
  router.patch("/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      let { status } = req.body;
      if (status && typeof status === "string") {
        status = status.toUpperCase();
      }
      const updatedIncident = await Incident.findByIdAndUpdate(
        id,
        { status: status },
        { new: true },
      );
      if (!updatedIncident) {
        return res
          .status(404)
          .json({ success: false, message: "Incident not found in database." });
      }
      //socket live broadcasting for status update
      io.emit("admin-incident-status-updated", updatedIncident);
      io.emit("incident-posted-public", updatedIncident);
      res.json({ success: true, data: updatedIncident });
    } catch (error) {
      console.error("Status Update Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  // 3. Post a new incident report from mobile app (AI Powered Version)
  router.post("/", upload.single("file"), async (req, res) => {
    try {
      // mobile bata aako reporterInfo & incidentType safely store garne
      let reporterName = "Anonymous";
      try {
        if (req.body.reporterInfo) {
          const parsedReporter = JSON.parse(req.body.reporterInfo);
          reporterName = parsedReporter.yourName || "Anonymous";
        }
      } catch (pErr) {
        console.warn("Reporter Info parse warning:", pErr);
      }
      const incidentType =
        req.body.incidentType || req.body.incidentCategory || "GENERAL";
      // 15 min vitra eautae user le report gare nagareko check garne
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const isDuplicate = await Incident.findOne({
        "reporterInfo.yourName": reporterName,
        incidentType: incidentType,
        createdAt: { $gte: fifteenMinutesAgo },
      });
      // yadi duplicati report vetiyema database save nagarne ra sidhai rokne
      if (isDuplicate) {
        console.log(
          ` [SPAM BLOCKED] Duplicate ${incidentType} alert prevented from user: ${reporterName}`,
        );
        return res.status(400).json({
          success: false,
          message:
            " You have already reported this incident recently. Our rescue teams are actively reviewing it!",
        });
      }
      const aiCategory =
        req.body.incidentCategory ||
        classifyIncidentPriority(req.body.description);

      // duplicate navayemaa matrae database object banaune
      const incidentData = {
        incidentCategory: aiCategory,
        incidentType: req.body.incidentType || aiCategory.toUpperCase(),
        incidentDate: req.body.incidentDate,
        locationName: req.body.locationName,
        latitude: parseFloat(req.body.latitude),
        longitude: parseFloat(req.body.longitude),
        description: req.body.description,
        status: "PENDING",
        suspectInfo: req.body.suspectInfo
          ? JSON.parse(req.body.suspectInfo)
          : {},
        reporterInfo: req.body.reporterInfo
          ? JSON.parse(req.body.reporterInfo)
          : {},
      };
      if (req.file) {
        incidentData.attachedFilePath = req.file.path;
      }
      const newIncident = new Incident(incidentData);
      await newIncident.save();
      runClusteringAndDetection(io);

      // Send live notification to admin panel
      io.emit("admin-new-incident", newIncident);
      res.status(201).json({ success: true, data: newIncident });
    } catch (error) {
      console.error("Post Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  //Delete an incident report (Admin Panel)
  router.delete("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      // Execute physical query cleanup on cluster
      const deletedIncident = await Incident.findByIdAndDelete(id);
      if (!deletedIncident) {
        return res.status(404).json({
          success: false,
          message: "Incident record not found inside cluster database.",
        });
      }
      // Capture express app application instance references for Socket.io
      const io = req.app.get("socketio");
      if (io) {
        // Broadcast globally to all nodes (mobiles, other dashboard instances)
        io.emit("incident-deleted-broadcast", id);
      }
      return res.status(200).json({
        success: true,
        message: "Incident deleted successfully from persistent storage.",
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  // 5. Count incidents for home screen categories
  router.get("/counts", async (req, res) => {
    try {
      const critical = await Incident.countDocuments({
        incidentCategory: "critical",
        status: "APPROVED",
      });
      const high = await Incident.countDocuments({
        incidentCategory: "high",
        status: "APPROVED",
      });
      const medium = await Incident.countDocuments({
        incidentCategory: "medium",
        status: "APPROVED",
      });
      const low = await Incident.countDocuments({
        incidentCategory: "low",
        status: "APPROVED",
      });
      res.json({ critical, high, medium, low });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  router.get("/approved", async (req, res) => {
    try {
      const approvedIncidents = await Incident.find({
        status: "APPROVED",
      }).sort({ createdAt: -1 });
      res.json(approvedIncidents);
    } catch (error) {
      console.error("Fetch Approved Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  //manually trigger a new incident report (for testing purposes)
  router.post("/incidents", async (req, res) => {
    try {
      console.log("BODY:", req.body);
      const incident = await Incident.create(req.body);
      io.emit("admin-new-incident", incident);
      res.status(201).json(incident);
    } catch (err) {
      console.log("FULL ERROR:");
      console.log(err);
      res.status(500).json({
        message: err.message,
      });
    }
  });
  return router;
};

const express = require("express");
const router = (reportFilterRouter = express.Router());
const Incident = require("../models/incident");

const { kmeans } = require("ml-kmeans");
const multer = require("multer");
const path = require("path");

const REPORT_THRESHOLD = 5;

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
          message: `🚨 Warning: ${clusterReports.length} incidents have been reported in this area recently!`,
        });
      }
    });
  } catch (err) {
    console.error("Clustering Error:", err);
  }
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

  // 2. PATCH
  router.patch("/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

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

      io.emit("admin-incident-status-updated", updatedIncident);

      res.json({ success: true, data: updatedIncident });
    } catch (error) {
      console.error("Status Update Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 3. Post a new incident report from mobile app
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
          `⚠️ [SPAM BLOCKED] Duplicate ${incidentType} alert prevented from user: ${reporterName}`,
        );
        return res.status(400).json({
          success: false,
          message:
            " You have already reported this incident recently. Our rescue teams are actively reviewing it!",
        });
      }

      // duplicate navayemaa matrae database object banaune
      const incidentData = {
        incidentCategory: req.body.incidentCategory,
        incidentType: req.body.incidentType,
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

  // 4. Fetch approved incidents for Incident Tab
  router.get("/approved", async (req, res) => {
    try {
      const approvedList = await Incident.find({ status: "APPROVED" }).sort({
        createdAt: -1,
      });
      res.json(approvedList);
    } catch (error) {
      res.status(500).json({ error: error.message });
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
  return router;
};

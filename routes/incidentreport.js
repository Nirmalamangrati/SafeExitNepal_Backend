const express = require("express");
const router = express.Router();
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

// K-Means Clustering & Threshold Detection Function (FIXED)
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
        const center = ans.centroids[index]; // center framework: [lat, lng]

        io.emit("high-density-crisis", {
          clusterId: index,
          latitude: center[0], //  Correct: Centroid array zero-index Latitude pulling
          longitude: center[1], //  Correct: Centroid array first-index Longitude pulling
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
  // 1. Post a new incident report from mobile app
  router.post("/", upload.single("file"), async (req, res) => {
    try {
      // Map FormData fields from React Native
      const incidentData = {
        incidentCategory: req.body.incidentCategory,
        incidentType: req.body.incidentType,
        incidentDate: req.body.incidentDate,
        locationName: req.body.locationName,
        latitude: parseFloat(req.body.latitude),
        longitude: parseFloat(req.body.longitude),
        description: req.body.description,
        // Parse JSON strings to objects safely
        suspectInfo: req.body.suspectInfo
          ? JSON.parse(req.body.suspectInfo)
          : {},
        reporterInfo: req.body.reporterInfo
          ? JSON.parse(req.body.reporterInfo)
          : {},
      };

      // Store file path in database if file is uploaded
      if (req.file) {
        incidentData.attachedFilePath = req.file.path;
      }

      const newIncident = new Incident(incidentData);
      await newIncident.save();

      // Trigger clustering detection safely
      runClusteringAndDetection(io);

      // Send live notification to admin panel
      io.emit("admin-new-incident", newIncident);

      res.status(201).json({ success: true, data: newIncident });
    } catch (error) {
      console.error("Post Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 2. Fetch approved incidents for Incident Tab
  router.get("/approved", async (req, res) => {
    try {
      const approvedList = await Incident.find({ status: "approved" }).sort({
        createdAt: -1,
      });
      res.json(approvedList);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 3. Count incidents for home screen categories
  router.get("/counts", async (req, res) => {
    try {
      const critical = await Incident.countDocuments({
        incidentCategory: "critical",
        status: "approved",
      });
      const high = await Incident.countDocuments({
        incidentCategory: "high",
        status: "approved",
      });
      const medium = await Incident.countDocuments({
        incidentCategory: "medium",
        status: "approved",
      });
      const low = await Incident.countDocuments({
        incidentCategory: "low",
        status: "approved",
      });

      res.json({ critical, high, medium, low });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};

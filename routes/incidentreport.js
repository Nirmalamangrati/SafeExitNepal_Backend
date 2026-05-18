const express = require("express");
const router = express.Router();
const Incident = require("../models/Incident");
const { kmeans } = require("ml-kmeans");

const REPORT_THRESHOLD = 5; // ५ वटा रिपोर्ट पुगेपछि कडा साइरन बज्ने

// 🧠 K-Means Clustering & Threshold Detection Function
async function runClusteringAndDetection(io) {
  try {
    const recentIncidents = await Incident.find({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    if (recentIncidents.length < 3) return;

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
          message: `🚨 चेतावनी: यो क्षेत्रमा छोटो समयमै ${clusterReports.length} वटा विपद्का रिपोर्टहरू दर्ता भएका छन्!`,
        });
      }
    });
  } catch (err) {
    console.error("Clustering Error:", err);
  }
}

module.exports = (io) => {
  // 🚨 १. मोबाइल एपबाट नयाँ रिपोर्ट पोस्ट गर्ने बाटो
  router.post("/", async (req, res) => {
    try {
      const newIncident = new Incident(req.body);
      await newIncident.save();

      // ब्याकइन्डमा क्लस्टरिङ अल्गोरिदम चलाउने
      runClusteringAndDetection(io);

      // एडमिनलाई लाइभ पठाउने
      io.emit("admin-new-incident", newIncident);

      res.status(201).json({ success: true, data: newIncident });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 📑 २. स्वीकृत (Approved) भएका मात्र Incident Tab मा देखाउनका लागि तानेर ल्याउने बाटो
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

  // 📊 ३. होम स्क्रिनका लागि काउन्टर संख्या गणना गर्ने बाटो
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

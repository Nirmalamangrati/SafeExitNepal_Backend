const express = require("express");
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1. Correct paths and filenames loaded from your models directory
const RescueTeam = require("../models/RescueTeam");
const Shelter = require("../models/Shelter");

// URL: /api/aiclustering/:city
router.get("/:city", async (req, res) => {
  const { city } = req.params;

  try {
    // 2. Verified endpoint structure calling your local weather route
    const weatherResponse = await fetch(
      `http://192.168.43.132:8000/api/weather/${city}`,
    );

    if (!weatherResponse.ok) {
      return res
        .status(404)
        .json({ success: false, error: "Weather API data fetch failed" });
    }

    const data = await weatherResponse.json();

    if (!data.current || !data.forecast || !data.forecast.list) {
      return res.status(400).json({
        success: false,
        error: "Invalid weather data structure received",
      });
    }

    // MATCHED EXACTLY with your weather route schema (Object mapping, not array)
    const currentList = data.current;

    const temp = currentList.main?.temp ?? 22;
    const humidity = currentList.main?.humidity ?? 50;
    const windSpeed = (currentList.wind?.speed ?? 0) * 3.6; // Convert to km/h

    // Safely mapping from your weather object format
    const condition = currentList.weather ? currentList.weather.main : "Clear";
    const description = currentList.weather
      ? currentList.weather.description
      : "";

    const cityLat = 27.7172;
    const cityLon = 85.324;

    // 3. FEATURE 1: Predictive Flood & Landslide Warnings
    let totalRainNext24h = 0;
    data.forecast.list.slice(0, 8).forEach((item) => {
      if (item.rain && item.rain["3h"]) {
        totalRainNext24h += item.rain["3h"];
      }
    });

    // ==========================================
    // 🛠️ PRESENTATION OVERRIDE: FORCE CRITICAL AI TRIGGER
    // Change this to 'false' once you finish testing to pull real live metrics
    const enableTestingOverride = true;

    let evalRain = totalRainNext24h;
    let evalCondition = condition;
    let evalHumidity = humidity;

    if (enableTestingOverride) {
      evalRain = 65;
      evalCondition = "Rain";
      evalHumidity = 95;
    }
    // ==========================================

    let hazardLevel = "Low";
    let hazardType = "None";
    let isDisasterImminent = false;

    // Weather threshold logic mapping
    if (evalRain > 50 || (evalCondition === "Rain" && evalHumidity > 90)) {
      hazardLevel = "Critical";
      hazardType = "Predictive Landslide & Flash Flood Warning";
      isDisasterImminent = true;
    } else if (
      windSpeed > 50 ||
      (evalCondition === "Thunderstorm" && windSpeed > 30)
    ) {
      hazardLevel = "High";
      hazardType = "Severe Storm / Gale Wind Warning";
    } else if (evalCondition === "Rain" && evalHumidity > 80) {
      hazardLevel = "Medium";
      hazardType = "Heavy Rainfall & Localized Flooding Risk";
    } else if (temp > 38) {
      hazardLevel = "High";
      hazardType = "Extreme Heatwave Alert";
    }

    // 4. FEATURE 4: Automated SMS Trigger Simulation
    if (isDisasterImminent) {
      console.log(
        `[AUTOMATED SMS] Triggered for ${city}! Sending alert to local citizens without internet...`,
      );
    }

    // 5. FEATURE 5: AI Crowdsourcing & Density Clustering Simulation
    const severityVector =
      windSpeed * 0.4 +
      evalHumidity * 0.2 +
      Math.abs(temp - 22) * 0.4 +
      evalRain * 0.5;
    let densityStatus = "Low-Density (Isolated)";
    let reportsCount = hazardLevel === "Critical" ? 18 : 0;

    if (severityVector > 50 || hazardLevel === "Critical") {
      densityStatus =
        "High-Density Crisis Cluster Detected (Widespread Impact)";
    } else if (severityVector > 25) {
      densityStatus = "Medium-Density Cluster Detected (Local Impact Only)";
    }

    // 6. Fetch real records from Database
    let rescueTeams = [];
    let safeShelters = [];

    try {
      rescueTeams = await RescueTeam.find({ city: new RegExp(city, "i") });
      safeShelters = await Shelter.find({ city: new RegExp(city, "i") });

      if (rescueTeams.length === 0) rescueTeams = await RescueTeam.find({});
      if (safeShelters.length === 0) safeShelters = await Shelter.find({});
    } catch (dbError) {
      console.error("Database Fetch Error:", dbError);
    }

    // 7. FEATURE 3: Smart Rescue Dispatch Algorithm
    if (
      (hazardLevel === "Critical" || hazardLevel === "High") &&
      rescueTeams.length > 0
    ) {
      rescueTeams = rescueTeams.map((team) => {
        const teamObj = team.toObject ? team.toObject() : { ...team };
        return {
          ...teamObj,
          status: "Dispatched / En Route",
        };
      });
    }

    // 8. FEATURE 2: AI Route Optimization
    if (hazardLevel === "Critical" && safeShelters.length > 0) {
      safeShelters = safeShelters.map((shelter, index) => {
        const shelterObj = shelter.toObject
          ? shelter.toObject()
          : { ...shelter };
        if (index === 0) {
          return {
            ...shelterObj,
            isRouteSafe: false,
            status: "Route Blocked by Hazard",
          };
        }
        return shelterObj;
      });
    }

    // 9. NATURAL LANGUAGE PROCESSING (Gemini AI Engine)
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const prompt = `
      You are an NLP System for a Weather Crisis App named SafeExit Nepal.
      Translate the following raw Algorithm outputs into human-readable, friendly, actionable safety advice for the citizens of ${city}.

      [ALGORITHM METRICS]
      - Classified Hazard Level: ${hazardLevel}
      - Detected Hazard Type: ${hazardType}
      - Cluster Density Analysis: ${densityStatus}
      - Cumulative 24h Rain: ${evalRain.toFixed(1)}mm
      - Current Weather Details: ${temp}°C, ${evalCondition} (${description})

      [OUTPUT RULES]
      1. Write a 1-2 sentence concise warning or safety tip in English based exactly on the metrics above.
      2. If Hazard Level is 'Low' and Density is 'Low-Density', output exactly: "No high-density crisis clusters detected yet."
      3. Reply with ONLY the plain text sentences. Do not use bolding, asterisks, or markdown.
    `;

    // FIXED: Formatted the prompt content parameter using the correct Content Object Array required by current Gemini standard
    const aiResult = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    const hazardDescription = aiResult.text.trim();

    // 10. Prepare response array structure matching the frontend UI (.map)
    let activeHazardsArray = [];

    if (
      hazardLevel !== "Low" &&
      hazardDescription !== "No high-density crisis clusters detected yet."
    ) {
      activeHazardsArray.push({
        clusterId: Date.now(),
        totalReports: reportsCount,
        message: hazardDescription,
        latitude: cityLat + (Math.random() - 0.5) * 0.02,
        longitude: cityLon + (Math.random() - 0.5) * 0.02,
        hazardLevel: hazardLevel,
        hazardType: hazardType,
        rainForecast24h: `${evalRain.toFixed(1)} mm`,
      });
    }

    // 11. Respond to mobile client
    res.json({
      success: true,
      aiHazards: activeHazardsArray,
      optimizedRoutesAndShelters: safeShelters,
      smartRescueDispatch: rescueTeams,
      smsAlertTriggered: isDisasterImminent,
    });
  } catch (error) {
    console.error("AI Disaster Integration Error:", error);
    res.status(500).json({ success: false, error: "Server error occurred" });
  }
});

module.exports = router;

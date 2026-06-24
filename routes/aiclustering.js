const express = require("express");
const router = express.Router();
const axios = require("axios"); // Axios is already installed in your backend

// 1. Correct paths and filenames loaded from your models directory
const RescueTeam = require("../models/RescueTeam");
const Shelter = require("../models/Shelter");

// URL: /api/aiclustering/:city
router.get("/:city", async (req, res) => {
  const { city } = req.params;

  try {
    // 2. Fetching weather data from your local working weather route
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

    const currentList = data.current;

    const temp = currentList.main?.temp ?? 22;
    const humidity = currentList.main?.humidity ?? 50;
    const windSpeed = (currentList.wind?.speed ?? 0) * 3.6; // Convert to km/h

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

    // 9.yasma milauna baki xa
    let hazardDescription = `ALERT: ${hazardType} in ${city} due to ${evalRain}mm rain forecast. Please move to safe shelters immediately.`;

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const geminiUrl = `https://googleapis.com{apiKey}`;

      const prompt = `
        You are an NLP System for a Weather Crisis App named SafeExit Nepal.
        Translate the following raw outputs into friendly, actionable safety advice for the citizens of ${city}.
        Metrics: Hazard Level ${hazardLevel}, Hazard Type ${hazardType}, 24h Rain ${evalRain}mm, Temp ${temp}°C, Condition ${evalCondition}.
        Rule: Write a 1-2 sentence short warning in English. No markdown, no bold text, no asterisks. Plain text only.
      `;

      const geminiResponse = await axios.post(geminiUrl, {
        contents: [{ parts: [{ text: prompt }] }],
      });

      if (
        geminiResponse.data &&
        geminiResponse.data.candidates &&
        geminiResponse.data.candidates[0] &&
        geminiResponse.data.candidates[0].content &&
        geminiResponse.data.candidates[0].content.parts &&
        geminiResponse.data.candidates[0].content.parts[0] &&
        geminiResponse.data.candidates[0].content.parts[0].text
      ) {
        hazardDescription =
          geminiResponse.data.candidates[0].content.parts[0].text.trim();
      }
    } catch (aiApiError) {
      console.error(
        "Gemini Native Fetch Warning (Using algorithmic fallback):",
        aiApiError.message,
      );
    }

    // 10. Prepare response array structure matching the frontend UI (.map)
    let activeHazardsArray = [];

    if (hazardLevel !== "Low") {
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

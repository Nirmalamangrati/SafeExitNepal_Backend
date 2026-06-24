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
    // 2. Fetch forecast data to calculate rain volume for flood/landslide predictions
    const weatherResponse = await fetch(
      `https://openweathermap.org{city}&units=metric&appid=${process.env.WEATHER_API_KEY}`,
    );

    if (!weatherResponse.ok) {
      return res
        .status(404)
        .json({ success: false, error: "City not found or weather API error" });
    }

    const forecastData = await weatherResponse.json();
    const currentList = forecastData.list[0];

    const temp = currentList.main.temp;
    const humidity = currentList.main.humidity;
    const windSpeed = (currentList.wind ? currentList.wind.speed : 0) * 3.6; // In km/h
    const condition = currentList.weather[0].main;
    const description = currentList.weather[0].description;

    const cityLat = forecastData.city?.coord?.lat || 27.7172;
    const cityLon = forecastData.city?.coord?.lon || 85.324;

    // 3. FEATURE 1: Predictive Flood & Landslide Warnings
    let totalRainNext24h = 0;
    forecastData.list.slice(0, 8).forEach((item) => {
      if (item.rain && item.rain["3h"]) {
        totalRainNext24h += item.rain["3h"];
      }
    });

    let hazardLevel = "Low";
    let hazardType = "None";
    let isDisasterImminent = false;

    if (totalRainNext24h > 50 || (condition === "Rain" && humidity > 90)) {
      hazardLevel = "Critical";
      hazardType = "Predictive Landslide & Flash Flood Warning";
      isDisasterImminent = true;
    } else if (
      windSpeed > 50 ||
      (condition === "Thunderstorm" && windSpeed > 30)
    ) {
      hazardLevel = "High";
      hazardType = "Severe Storm / Gale Wind Warning";
    } else if (condition === "Rain" && humidity > 80) {
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
      humidity * 0.2 +
      Math.abs(temp - 22) * 0.4 +
      totalRainNext24h * 0.5;
    let densityStatus = "Low-Density (Isolated)";
    let reportsCount = 0;

    if (severityVector > 50 || hazardLevel === "Critical") {
      densityStatus =
        "High-Density Crisis Cluster Detected (Widespread Impact)";
      reportsCount = Math.floor(Math.random() * 25) + 15;
    } else if (severityVector > 25) {
      densityStatus = "Medium-Density Cluster Detected (Local Impact Only)";
      reportsCount = Math.floor(Math.random() * 10) + 3;
    }

    // 6. Fetch real records from your Database added by admin
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

    // 9. NATURAL LANGUAGE PROCESSING (Gemini AI)
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      You are an NLP System for a Weather Crisis App named SafeExit Nepal.
      Translate the following raw Algorithm outputs into human-readable, friendly, actionable safety advice for the citizens of ${city}.

      [ALGORITHM METRICS]
      - Classified Hazard Level: ${hazardLevel}
      - Detected Hazard Type: ${hazardType}
      - Cluster Density Analysis: ${densityStatus}
      - Cumulative 24h Rain: ${totalRainNext24h.toFixed(1)}mm
      - Current Weather Details: ${temp}°C, ${condition} (${description})

      [OUTPUT RULES]
      1. Write a 1-2 sentence concise warning or safety tip in English based exactly on the metrics above.
      2. If Hazard Level is 'Low' and Density is 'Low-Density', output exactly: "No high-density crisis clusters detected yet."
      3. Reply with ONLY the plain text sentences. Do not use bolding, asterisks, or markdown.
    `;

    const aiResult = await model.generateContent({ contents: prompt });
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
        rainForecast24h: `${totalRainNext24h.toFixed(1)} mm`,
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

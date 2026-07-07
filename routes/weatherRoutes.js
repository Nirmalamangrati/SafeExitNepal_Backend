const express = require("express");
const router = express.Router();
const axios = require("axios");

// Your OpenWeatherMap API Key
const safeexitweather = "5129d2e16d58ee35c833af12c71ce3ee";

router.get("/:city", async (req, res) => {
  const { city } = req.params;
  const cleanCity = city && city.trim() !== "" ? city.trim() : "Biratnagar";

  try {
    // 1. Correct API URL for current weather data
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${cleanCity}&appid=${safeexitweather}&units=metric`;

    // 2. Correct API URL for 5-day / 3-hour forecast data
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${cleanCity}&appid=${safeexitweather}&units=metric`;
    // Fetch both datasets simultaneously to optimize speed
    const [currentRes, forecastRes] = await Promise.all([
      axios.get(currentUrl),
      axios.get(forecastUrl),
    ]);
    const cur = currentRes.data;
    const weatherData =
      cur.weather && cur.weather.length > 0
        ? cur.weather[0]
        : { main: "Clear", description: "clear sky", icon: "01d" };
    // Send perfectly formatted data structure to your React Native application
    res.json({
      current: {
        name: cur.name,
        sys: { country: cur.sys?.country },
        main: {
          temp: cur.main?.temp,
          humidity: cur.main?.humidity,
          feels_like: cur.main?.feels_like,
        },
        wind: { speed: cur.wind?.speed },
        weather: {
          main: weatherData.main,
          description: weatherData.description,
          icon: weatherData.icon,
        },
      },
      forecast: forecastRes.data,
    });
  } catch (error) {
    if (error.response) {
      console.error(
        "OpenWeather Server Error Details:",
        error.response.status,
        error.response.data,
      );
      res
        .status(error.response.status)
        .json({ message: error.response.data.message });
    } else {
      console.error("Backend Weather Main Error:", error.message);
      res.status(500).json({ message: "City not found or OpenWeather Error" });
    }
  }
});
module.exports = router;

const express = require("express");
const router = express.Router();
const axios = require("axios");
const safeexitweather = "5c69533670cef7f0962dd11d72d04f683";

router.get("/:city", async (req, res) => {
  const { city } = req.params;
  const cleanCity = city && city.trim() !== "" ? city.trim() : "Lalitpur";
  try {
    const currentRes = await axios.get(
      `https://openweathermap.org{cleanCity}&appid=${safeexitweather}&units=metric`,
    );
    const forecastRes = await axios.get(
      `https://openweathermap.org{cleanCity}&appid=${safeexitweather}&units=metric`,
    );

    const cur = currentRes.data;
    const weatherData =
      cur.weather && cur.weather.length > 0
        ? cur.weather[0]
        : { main: "Clear", description: "clear sky", icon: "01d" };

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
        " OpenWeather Server Error Details:",
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

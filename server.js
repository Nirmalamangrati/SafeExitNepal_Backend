const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// 1. ROUTES CONNECTION
app.use("/api/auth", require("./routes/authRoutes"));

app.get("/", (req, res) => {
  res.send("SafeExitNepal Backend Running...");
});

// 2. DATABASE CONFIGURATION (SAFE URL EXTRACTOR)
const dbURI = process.env.MONGO_URI || process.env.MONGODB_URI;
let cleanURI = dbURI;

if (dbURI) {
  try {
    if (dbURI.includes("?")) {
      const urlParts = dbURI.split("?");
      let basePart = urlParts[0];
      const queryPart = urlParts[1];

      const protocolEndIndex = basePart.indexOf("://") + 3;
      const lastSlashIndex = basePart.lastIndexOf("/");

      if (lastSlashIndex > protocolEndIndex) {
        basePart = basePart.substring(0, lastSlashIndex);
      }

      cleanURI = `${basePart}/safeexitdb?${queryPart}`;
    } else {
      if (dbURI.endsWith("/")) {
        cleanURI = dbURI + "safeexitdb";
      } else {
        const protocolEndIndex = dbURI.indexOf("://") + 3;
        const lastSlashIndex = dbURI.lastIndexOf("/");
        if (lastSlashIndex > protocolEndIndex) {
          cleanURI = dbURI.substring(0, lastSlashIndex) + "/safeexitdb";
        } else {
          cleanURI = dbURI + "/safeexitdb";
        }
      }
    }
  } catch (e) {
    cleanURI = dbURI;
  }
}

// 3. SINGLE MONGOOSE CONNECTION (WITH FALLBACK GUARD)
mongoose
  .connect(cleanURI)
  .then(() =>
    console.log(" MongoDB Atlas (Fresh Database) Connected Successfully!"),
  )
  .catch((err) => {
    console.log(
      " Connection Error on fresh URI, fallback to original connection string...",
    );
    mongoose
      .connect(dbURI)
      .then(() =>
        console.log(" MongoDB Connected Successfully using default env URI!"),
      )
      .catch((fallbackErr) =>
        console.log("Core Database Connection Error: ", fallbackErr),
      );
  });

// 4. SERVER LISTEN PORT CONFIGURATION
const PORT = process.env.PORT || 8000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://192.168.43.132:${PORT}`);
  console.log(`Server is also listening on local network via 0.0.0.0:${PORT}`);
});

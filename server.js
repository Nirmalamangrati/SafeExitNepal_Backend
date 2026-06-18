const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");
const User = require("./models/User");
const Shelter = require("./models/Shelter");
const offline = require("./models/offline");
const serviceAccount = require("./safeexit-firebase-key.json");
const offlineResourcesRouteInitializer = require("./routes/offlineResources");
const hotlineRoutes = require("./routes/hotlineRoutes");
const app = express();

app.set("trust proxy", 1);
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  }),
);
app.use(express.json());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

console.log("Firebase Admin SDK Successfully Initialized!");

// Initialize Native HTTP Server and Socket.io with proper CORS configurations
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
});
// Store socket instance globally inside Express engine
app.set("io", io);

// Network Telemetry Logs for Socket Connection Status
io.on("connection", (socket) => {
  console.log(` New Device Connected via Socket: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(` Device Disconnected from Socket: ${socket.id}`);
  });
});

// App Router Declarations
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/profile", require("./routes/profile"));
app.use("/api/teams", require("./routes/teams"));

const incidentRouter = require("./routes/incidentreport")(io);
app.use("/api/incidents", incidentRouter);

const safeshelterRouter = require("./routes/safeshelter")(io);
app.use("/api/safeshelter", safeshelterRouter);

app.use("/api/sos", require("./routes/sosRoutes"));
app.use("/api/hotlines", hotlineRoutes);
app.get("/", (req, res) => {
  res.send("SafeExitNepal Backend Running with Real-time SOS Engine...");
});

//  2. naya route lai 'io' pass gardae yaa link gariyo
const offlineResourcesRouter = offlineResourcesRouteInitializer(io);
app.use("/api/resources", offlineResourcesRouter);

//  3. upload folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
if (!fs.existsSync("./uploads")) {
  fs.mkdirSync("./uploads");
}

// Database URL Sanitizer Configuration Layer
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

// Single Instance MongoDB Connection Blueprint
mongoose
  .connect(cleanURI)
  .then(() => console.log(" MongoDB Atlas Connected Successfully!"))
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

// Expo Server Network Listener Hook (Using http.server instead of app.listen)
const PORT = process.env.PORT || 8000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://192.168.43.132:${PORT}`);
  console.log(`Server is also listening on local network via 0.0.0.0:${PORT}`);
});

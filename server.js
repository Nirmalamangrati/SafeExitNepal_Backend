const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

// routes
app.use("/api/auth", require("./routes/authRoutes"));

app.get("/", (req, res) => {
  res.send("SafeExitNepal Backend Running...");
});

const dbURI = process.env.MONGO_URI || process.env.MONGODB_URI;

mongoose
  .connect(dbURI)
  .then(() => console.log("MongoDB Connected Successfully!"))
  .catch((err) => console.log("Connection Error: ", err));

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

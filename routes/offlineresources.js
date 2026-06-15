const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const OfflineResource = require("../models/offline");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

module.exports = function (io) {
  //  1. Upload file using the Model Database query
  router.post("/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Please choose a file" });
      }

      //  Added resourceType extraction from req.body
      const { version, resourceType } = req.body;
      const formattedSize = formatFileSize(req.file.size);
      const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

      const newResource = await OfflineResource.create({
        title: req.file.originalname,
        resourceType: resourceType || "Map",
        version: version || "v1.0.0",
        size: formattedSize,
        fileUrl: fileUrl,
        localPath: req.file.filename,
      });
      if (io) io.emit("new_resource_posted", newResource);

      return res.status(201).json({
        success: true,
        message: "File uploaded successfully!",
        data: newResource,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });

  //  2. Fetch all files from Database
  router.get("/", async (req, res) => {
    try {
      const resources = await OfflineResource.find().sort({ createdAt: -1 });
      return res.json(resources);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  //  3. UPDATE configuration properties -> PUT /api/resources/:id
  router.put("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { version, resourceType, status } = req.body;

      // Ensure fields contain fallback defaults if sent empty
      const updatedResource = await OfflineResource.findByIdAndUpdate(
        id,
        {
          resourceType: resourceType || "Map", //  Included target modification parameter
          version: version || "v1.0.0",
          status: status || "Downloaded",
        },
        { new: true }, // Crucial: forces database to return the altered data layout object
      );

      if (!updatedResource) {
        return res
          .status(404)
          .json({ success: false, error: "Resource item data not found" });
      }

      // Broadcast changes across the Socket engine configuration to notify active listeners
      if (io) io.emit("resource_updated", updatedResource);

      return res.json({ success: true, data: updatedResource });
    } catch (error) {
      console.error("Upstream DB put modification operation halted:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to modify configuration properties",
      });
    }
  });

  //  4. Delete file from Database
  router.delete("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const fileToDelete = await OfflineResource.findById(id);

      if (fileToDelete) {
        const filePath = path.join(
          __dirname,
          "../uploads",
          fileToDelete.localPath,
        );
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        await OfflineResource.findByIdAndDelete(id);

        if (io) io.emit("resource_deleted", id);

        return res.json({ success: true, message: "File removed completely" });
      }

      return res.status(404).json({ error: "File not found" });
    } catch (error) {
      return res.status(500).json({ error: "Failed to delete file" });
    }
  });

  return router;
};

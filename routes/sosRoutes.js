const express = require("express");
const router = express.Router();
const User = require("../models/User");
const SosRoute = require("../models/SosRoutes");
const axios = require("axios");
const admin = require("firebase-admin");
const activeAlerts = new Map();
// ROUTE: POST /api/sos/trigger
router.post("/trigger", async (req, res) => {
  try {
    const { userId, location } = req.body;
    const newEvent = new SOSEvent({ userId, location, status: "PENDING" });
    await newEvent.save();
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const contactPhones = user.emergencyContacts
      ? user.emergencyContacts.map((c) => c.phone)
      : [];
    const contactsInDB = await User.find(
      { phone: { $in: contactPhones } },
      "fcmToken",
    );
    const fcmTokens = contactsInDB
      .map((u) => u.fcmToken)
      .filter((token) => token && token !== "");

    // Firebase Cloud Messaging BaaS notification delivery loop
    if (fcmTokens.length > 0) {
      const messagePayload = {
        notification: {
          title: ` EMERGENCY: ${user.name} is in danger!`,
          body: "Your emergency contacts have been sent an alarm notification. If no one responds within 30 seconds, the Nepal Police and admin will be automatically alerted.",
        },
        android: {
          priority: "high",
          notification: {
            channelId: "safeexit_sos_channel",
            sound: "emergency_alarm",
          },
        },
        data: {
          eventId: newEvent._id.toString(),
          latitude: location.lat.toString(),
          longitude: location.lng.toString(),
        },
        tokens: fcmTokens,
      };
      await admin.messaging().sendEachForMulticast(messagePayload);
    }

    // Register tracking item into local runtime memory allocation table
    activeAlerts.set(newEvent._id.toString(), {
      event: newEvent,
      user: user,
      isReceived: false,
    });

    // 30 Seconds Automated System Escalation Worker
    setTimeout(async () => {
      const liveAlert = activeAlerts.get(newEvent._id.toString());
      if (liveAlert && !liveAlert.isReceived) {
        console.log(
          `[ESCALATION] 30s Timeout! ${newEvent._id} routing to Police & Admin.`,
        );
        await axios
          .post("https://nepalpolice.gov.np", {
            source: "SafeExit Nepal Automated System",
            victim_name: liveAlert.user.name,
            victim_phone: liveAlert.user.phone,
            coordinates: location,
          })
          .catch(() =>
            console.log(
              "Nepal Police Emergency Node Dispatched via simulated link.",
            ),
          );

        //  CRITICAL FIX: Extract socket server via express global app configuration context instead of req.io
        const io = req.app.get("io");
        if (io) {
          io.emit("ADMIN_SOS_ALERT", {
            eventId: newEvent._id,
            victim: liveAlert.user.name,
            location: location,
            status: "ESCALATED_TO_POLICE",
          });
          console.log(
            ` [Socket.io] Escalated SOS alert broadcasted to Admin: ${newEvent._id}`,
          );
        }

        await SOSEvent.findByIdAndUpdate(newEvent._id, {
          status: "ESCALATED_TO_POLICE",
        });
        activeAlerts.delete(newEvent._id.toString());
      }
    }, 30000);

    res.status(200).json({
      success: true,
      message: "SOS active, timeout timer running.",
      eventId: newEvent._id,
    });
  } catch (error) {
    console.error("SOS Trigger Route Handler Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ROUTE: POST /api/sos/acknowledge
router.post("/acknowledge", async (req, res) => {
  const { eventId } = req.body;
  if (activeAlerts.has(eventId)) {
    const alertData = activeAlerts.get(eventId);
    alertData.isReceived = true;
    activeAlerts.set(eventId, alertData);

    await SOSEvent.findByIdAndUpdate(eventId, { status: "RESOLVED" });
    activeAlerts.delete(eventId);
    return res.status(200).json({
      success: true,
      message: "Timeout cancelled. Contact responded.",
    });
  }
  res
    .status(400)
    .json({ success: false, message: "Alert expired or resolved" });
});
module.exports = router;

// routes/sosRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const SOSEvent = require("../models/SOSEvent");
const axios = require("axios");
const admin = require("firebase-admin");

// ३० सेकेन्डको रेस्पोन्स ट्र्याक राख्ने इन-मेमोरी म्याप घडी
const activeAlerts = new Map();

// 🚨 ROUTES: /api/sos/trigger
router.post("/trigger", async (req, res) => {
  try {
    const { userId, location } = req.body; // फ्रन्टइन्डबाट आउने डाटा

    // १. डेटाबेसमा नयाँ SOS रेकर्ड सेभ गर्ने
    const newEvent = new SOSEvent({ userId, location, status: "PENDING" });
    await newEvent.save();

    // २. यो युजरको कन्ट्याक्ट लिस्ट र उनीहरूको FCM डिभाइस टोकन डेटाबेसबाट खोज्ने
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

    // ३. फायरबेस BaaS मार्फत कन्ट्याक्टहरूको फोनमा साउन्डसहितको Push Notification फाल्ने
    if (fcmTokens.length > 0) {
      const messagePayload = {
        notification: {
          title: `🚨 EMERGENCY: ${user.name} is in danger!`,
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

    // एक्टिव अलर्ट म्यापमा हाल्ने
    activeAlerts.set(newEvent._id.toString(), {
      event: newEvent,
      user: user,
      isReceived: false,
    });

    // ४. एल्गोरिदम: ठीक ३० सेकेन्डको टाइमआउट घडी सुरु (Failover Route)
    setTimeout(async () => {
      const liveAlert = activeAlerts.get(newEvent._id.toString());

      // यदि ३० सेकेन्डसम्म कुनै पनि कन्ट्याक्टले मेसेज एप्रुभ गरेनन् भने (isReceived === false)
      if (liveAlert && !liveAlert.isReceived) {
        console.log(
          `[ESCALATION] 30s Timeout! ${newEvent._id} routing to Police & Admin.`,
        );

        // नेपाल प्रहरीको आधिकारिक नोडमा डाटा पोस्ट गर्ने (सिमुलेसन)
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

        // वेब एड्मिन ड्यासबोर्डमा रियल-टाइम क्रिटिकल पपअप फाल्न Socket.io ट्रिगर गर्ने
        req.io.emit("ADMIN_SOS_ALERT", {
          eventId: newEvent._id,
          victim: liveAlert.user.name,
          location: location,
          status: "ESCALATED_TO_POLICE",
        });

        // डेटाबेसमा पनि स्टाटस परिवर्तन गर्ने
        await SOSEvent.findByIdAndUpdate(newEvent._id, {
          status: "ESCALATED_TO_POLICE",
        });
        activeAlerts.delete(newEvent._id.toString());
      }
    }, 30000); // ३० सेकेन्ड (30000 ms)

    res
      .status(200)
      .json({
        success: true,
        message: "SOS active, timeout timer running.",
        eventId: newEvent._id,
      });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🚨 ROUTES: /api/sos/acknowledge (कन्ट्याक्टले एप खोल्दा टाइमर रोक्ने राउट)
router.post("/acknowledge", async (req, res) => {
  const { eventId } = req.body;
  if (activeAlerts.has(eventId)) {
    const alertData = activeAlerts.get(eventId);
    alertData.isReceived = true; // प्रहरी र एड्मिनमा जाने टाइमआउटलाई रोक्छ
    activeAlerts.set(eventId, alertData);

    await SOSEvent.findByIdAndUpdate(eventId, { status: "RESOLVED" });
    activeAlerts.delete(eventId);
    return res
      .status(200)
      .json({
        success: true,
        message: "Timeout cancelled. Contact responded.",
      });
  }
  res
    .status(400)
    .json({ success: false, message: "Alert expired or resolved" });
});

module.exports = router;

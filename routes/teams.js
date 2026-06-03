const express = require("express");
const router = express.Router();
const Incident = require("../models/Incident");
const axios = require("axios");
// 1. KALMAN FILTER ALGORITHM (GPS Smoothing)
const kalmanStates = {}; //memory maa pratek teamko state rakhna
function initKalmanState() {
  return {
    q: 0.00001, // Process Noise
    r: 0.001, // Measurement Noise
    x: null, // Estimated Latitude
    y: null, // Estimated Longitude
    p: 1.0, // Estimation Error Covariance
  };
}
function applyKalmanFilter(teamId, measuredLat, measuredLng) {
  if (!kalmanStates[teamId]) {
    kalmanStates[teamId] = initKalmanState();
    kalmanStates[teamId].x = measuredLat;
    kalmanStates[teamId].y = measuredLng;
    return { lat: measuredLat, lng: measuredLng };
  }
  const state = kalmanStates[teamId];
  // Prediction Update
  state.p = state.p + state.q;
  // Kalman Gain Calculation
  const k = state.p / (state.p + state.r);
  // Correction Update (Latitude र Longitude dubailai smooth garne)
  state.x = state.x + k * (measuredLat - state.x);
  state.y = state.y + k * (measuredLng - state.y);
  state.p = (1 - k) * state.p;
  return { lat: state.x, lng: state.y };
}
// 2. K-MEANS CLUSTERING ALGORITHM (AI Clustering)
function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p1.lat - p2.lat, 2) + Math.pow(p1.lng - p2.lng, 2));
}
function kMeansClustering(points, k = 3, maxIterations = 10) {
  if (points.length === 0) return [];
  // prarambhik centroids (Centroids) xanne
  let centroids = points.slice(0, k).map((p) => ({ lat: p.lat, lng: p.lng }));
  let clusters = Array(k)
    .fill(null)
    .map(() => []);
  for (let iter = 0; iter < maxIterations; iter++) {
    clusters = Array(k)
      .fill(null)
      .map(() => []);
    // pratek point lai sabaivanda najikko centroidma assign garne
    points.forEach((point) => {
      let minDist = Infinity;
      let clusterIndex = 0;
      centroids.forEach((centroid, index) => {
        const dist = getDistance(point, centroid);
        if (dist < minDist) {
          minDist = dist;
          clusterIndex = index;
        }
      });
      clusters[clusterIndex].push(point);
    });
    // new cetroids calculate garne
    let moved = false;
    for (let i = 0; i < k; i++) {
      if (clusters[i].length === 0) continue;
      let sumLat = 0,
        sumLng = 0;
      clusters[i].forEach((p) => {
        sumLat += p.lat;
        sumLng += p.lng;
      });
      let newLat = sumLat / clusters[i].length;
      let newLng = sumLng / clusters[i].length;
      if (centroids[i].lat !== newLat || centroids[i].lng !== newLng) {
        centroids[i] = { lat: newLat, lng: newLng };
        moved = true;
      }
    }
    if (!moved) break; //if centroids moved bhayena vane loop bata niskine
  }
  return centroids.map((c, index) => ({
    clusterId: index + 1,
    centerLatitude: c.lat,
    centerLongitude: c.lng,
    totalIncidentsInCluster: clusters[index].length,
    incidents: clusters[index],
  }));
}
// OSRM API Function (Dijkstra/A*)
async function getRoadRouteDetails(startLat, startLng, endLat, endLng) {
  try {
    const url = `http://project-osrm.org{startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    const response = await axios.get(url);
    if (response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes;
      return {
        roadCoordinates: route.geometry.coordinates.map((coord) => ({
          latitude: coord,
          longitude: coord,
        })),
        roadDistanceKm: (route.distance / 1000).toFixed(2),
        etaMinutes: (route.duration / 60).toFixed(0),
      };
    }
  } catch (error) {
    console.error("OSRM Routing API Fallback used.");
  }
  return { roadCoordinates: [], roadDistanceKm: "N/A", etaMinutes: "N/A" };
}
function getHaversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
// 0. FETCH ALL TEAMS (GET)
router.get("/", async (req, res) => {
  try {
    // Query parameters for Haversine distance calculation
    const { reporterName, userLat, userLng } = req.query;
    const teamsWithIncidents = await Incident.find({
      rescueTeamInfo: { $exists: true, $ne: null },
    }).sort({ createdAt: -1 });
    let formattedTeams = [];
    // Promise.all loop to process each team concurrently for better performance, especially when there are many teams
    await Promise.all(
      teamsWithIncidents.map(async (doc) => {
        const info = doc.rescueTeamInfo || {};
        const currentStatus = info.status || "Available";
        // Algorithm: if On the Way ho & reporter match hudaena vane arulai lukaune
        if (currentStatus === "On the Way" || currentStatus === "On the way") {
          const docReporter = doc.reporterInfo ? doc.reporterInfo.yourName : "";
          if (docReporter !== reporterName) return;
        }
        //  applai KALMAN FILTER: location dataharu jump huna bata jigauna ra smooth banauna
        const rawLat = info.latitude || doc.latitude || 27.7172;
        const rawLng = info.longitude || doc.longitude || 85.324;
        const filteredLoc = applyKalmanFilter(
          doc._id.toString(),
          rawLat,
          rawLng,
        );
        //applai HAVERSINE: user ra team bichko sidha distance nikalna
        let straightDistance = Infinity;
        if (userLat && userLng) {
          straightDistance = getHaversineDistance(
            parseFloat(userLat),
            parseFloat(userLng),
            filteredLoc.lat,
            filteredLoc.lng,
          );
        }
        //  applai DIJKSTRA / A* (OSRM): yadi team 'On the Way' xa vane road distance nikalne
        let routingData = {
          roadCoordinates: [],
          roadDistanceKm: "N/A",
          etaMinutes: "N/A",
        };
        if (
          (currentStatus === "On the Way" || currentStatus === "On the way") &&
          doc.latitude &&
          doc.longitude
        ) {
          routingData = await getRoadRouteDetails(
            filteredLoc.lat,
            filteredLoc.lng,
            doc.latitude,
            doc.longitude,
          );
        }
        formattedTeams.push({
          _id: doc._id,
          id: doc._id,
          name: info.teamName || info.name || "Rescue Team",
          contact: info.contact || "N/A",
          members: info.members || "0",
          crew: info.members || "0",
          email: info.email || "",
          website: info.website || "",
          status: currentStatus,
          location: info.location || doc.locationName || "N/A",
          locationName: info.location || doc.locationName || "N/A",
          // algorithm ko output haru
          distanceFromMe:
            straightDistance !== Infinity
              ? straightDistance.toFixed(2) + " km"
              : "N/A",
          straightDistanceNum: straightDistance,
          roadRoute: routingData.roadCoordinates,
          roadDistance: routingData.roadDistanceKm,
          eta: routingData.etaMinutes
            ? routingData.etaMinutes + " mins"
            : "N/A",
          // kalman filter applied location (team ko current smoothed location) - yo nai frontend ma dekhaune
          latitude: filteredLoc.lat,
          longitude: filteredLoc.lng,
          // pidit aafai uviyeko location
          clientLatitude: doc.latitude || 27.7172,
          clientLongitude: doc.longitude || 85.324,
        });
      }),
    );
    // 4. HAVERSINE SORTING:distanceko aadhar maa sabaivanda najikko team aauxa
    if (userLat && userLng) {
      formattedTeams.sort(
        (a, b) => a.straightDistanceNum - b.straightDistanceNum,
      );
    }
    return res.status(200).json(formattedTeams);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});
// NEW API: GET INCIDENT CLUSTERS (K-MEANS)
// admin panelko 'Active Hazards' mapma dekhaune cluster data dinay API, jasma K-means clustering algorithm apply garera hotspots identify garne
router.get("/analytics/clusters", async (req, res) => {
  try {
    // database bata sabai incidents fetch garne, jasma latitude ra longitude field haru exist garne
    const incidents = await Incident.find({
      latitude: { $exists: true },
      longitude: { $exists: true },
    });
    //k-meansko lagi data format garne (latitude ra longitude lai point object ma convert garne)
    const points = incidents.map((doc) => ({
      incidentId: doc._id,
      title: doc.description || "Emergency Call",
      category: doc.incidentCategory,
      lat: doc.latitude,
      lng: doc.longitude,
    }));
    // if points are less than 3, then k value should be less than number of points to avoid empty clusters
    const kValue = points.length >= 3 ? 3 : points.length;
    const clusterResults = kMeansClustering(points, kValue);
    return res.status(200).json({
      success: true,
      totalIncidentsReported: points.length,
      clusters: clusterResults, // frontendko 'Active Hazards via AI Clustering' lai data dinxa
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});
// 1. UPDATE TEAM STATUS (PATCH)
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status)
      return res.status(400).json({ message: "Status field is required." });
    const updated = await Incident.findByIdAndUpdate(
      id,
      { $set: { "rescueTeamInfo.status": status } },
      { new: true },
    );
    if (!updated)
      return res.status(404).json({ message: "Rescue team not found." });
    return res.status(200).json({
      message: "Status updated successfully",
      team: { id: updated._id, status: updated.rescueTeamInfo.status },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});
// 2. DELETE TEAM (DELETE)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Incident.findByIdAndDelete(id);
    if (!deleted)
      return res.status(404).json({ message: "Rescue team not found." });
    return res.status(200).json({ message: "Team deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});
// 3. REGISTER/ADD NEW TEAM (POST)
router.post("/", async (req, res) => {
  try {
    const {
      name,
      contact,
      members,
      email,
      website,
      status,
      location,
      latitude,
      longitude,
    } = req.body;

    if (!name || !contact || !members || !location) {
      return res.status(400).json({ message: "Required fields are missing." });
    }
    const setLat = latitude || 27.7172;
    const setLng = longitude || 85.324;
    const newTeamIncident = new Incident({
      incidentCategory: "low",
      incidentType: "other",
      incidentDate: String(Date.now()),
      locationName: String(location),
      latitude: setLat,
      longitude: setLng,
      description: "Rescue Team Auto Registration Stack Process",
      rescueTeamInfo: {
        teamName: name,
        name: name,
        contact: String(contact),
        members: String(members),
        email: email || "",
        website: website || "",
        status: status || "Available",
        location: String(location),
        latitude: setLat,
        longitude: setLng,
      },
    });
    const saved = await newTeamIncident.save();
    const formattedTeam = {
      _id: saved._id,
      id: saved._id,
      name: saved.rescueTeamInfo.teamName || saved.rescueTeamInfo.name,
      contact: saved.rescueTeamInfo.contact,
      members: saved.rescueTeamInfo.members,
      crew: saved.rescueTeamInfo.members,
      email: saved.rescueTeamInfo.email,
      website: saved.rescueTeamInfo.website,
      status: saved.rescueTeamInfo.status,
      location: saved.rescueTeamInfo.location,
      locationName: saved.rescueTeamInfo.location,
      latitude: setLat,
      longitude: setLng,
      clientLatitude: setLat,
      clientLongitude: setLng,
    };
    const io = req.app.get("io");
    if (io) {
      io.emit("team-added-or-updated", formattedTeam);
    }
    return res.status(201).json(formattedTeam);
  } catch (error) {
    console.error("Post Error on Teams Router:", error);
    return res.status(500).json({ message: error.message });
  }
});

// ४. UPDATE WHOLE TEAM / EDIT (PUT)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      contact,
      members,
      email,
      website,
      status,
      location,
      latitude,
      longitude,
    } = req.body;

    const setLat = latitude || 27.7172;
    const setLng = longitude || 85.324;

    const updated = await Incident.findByIdAndUpdate(
      id,
      {
        $set: {
          locationName: String(location),
          latitude: setLat,
          longitude: setLng,
          "rescueTeamInfo.teamName": name,
          "rescueTeamInfo.name": name,
          "rescueTeamInfo.contact": String(contact),
          "rescueTeamInfo.members": String(members),
          "rescueTeamInfo.email": email || "",
          "rescueTeamInfo.website": website || "",
          "rescueTeamInfo.status": status || "Available",
          "rescueTeamInfo.location": String(location),
          "rescueTeamInfo.latitude": setLat,
          "rescueTeamInfo.longitude": setLng,
        },
      },
      { new: true },
    );
    if (!updated)
      return res.status(404).json({ message: "Rescue team not found." });
    const formattedUpdatedTeam = {
      _id: updated._id,
      id: updated._id,
      name: updated.rescueTeamInfo.teamName,
      contact: updated.rescueTeamInfo.contact,
      members: updated.rescueTeamInfo.members,
      crew: updated.rescueTeamInfo.members,
      email: updated.rescueTeamInfo.email,
      website: updated.rescueTeamInfo.website,
      status: updated.rescueTeamInfo.status,
      location: updated.rescueTeamInfo.location,
      locationName: updated.rescueTeamInfo.location,
      latitude: setLat,
      longitude: setLng,
      clientLatitude: updated.latitude || setLat,
      clientLongitude: updated.longitude || setLng,
    };
    // REAL-TIME SOCKET EMIT
    const io = req.app.get("io");
    if (io) {
      io.emit("team-added-or-updated", formattedUpdatedTeam);
    }
    return res.status(200).json(formattedUpdatedTeam);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;

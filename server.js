// =============================================================
// CRACKTHECODE — TWITCH LIVE ORDER API
// Node.js / Express — Version avec lesfaineants + dacemaster
// =============================================================

const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

// ==========================================
// 🔐 TES VARIABLES D’ENVIRONNEMENT (Render)
// ==========================================
const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

// ==========================================
// 📺 LISTE DES CHAÎNES (mise à jour ici)
// ==========================================
const CHANNELS = [
  "valiv2",
  "crackthecode1",
  "whiteshad0wz1989",
  "lyvickmax",
  "skyrroztv",
  "cohhcarnage",
  "kokushibo66612",
  "lesfaineants",   // ⭐ AJOUT
  "dacemaster",     // ⭐ AJOUT
  "lvndmark",
  "eslcs",
  "explorajeux"
];

// ==========================================
// PRIORITÉ LIVE — ordre d'apparition
// ==========================================
const PRIORITY = [
  "valiv2",
  "crackthecode1",
  "whiteshad0wz1989",
  "lyvickmax",
  "skyrroztv",
  "cohhcarnage",
  "explorajeux",
  "kokushibo66612",
  "lesfaineants",   // ⭐ AJOUT
  "dacemaster",     // ⭐ AJOUT
  "lvndmark",
  "eslcs"
];

// ==========================================
// 🔑 OBTENIR TOKEN TWITCH
// ==========================================
async function getAccessToken() {
  const url = `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`;

  const res = await fetch(url, { method: "POST" });
  const data = await res.json();
  return data.access_token;
}

// ==========================================
// 📡 OBTENIR LA LISTE DES CHAÎNES LIVE
// ==========================================
async function fetchLiveChannels(token) {
  const base = "https://api.twitch.tv/helix/streams?first=100";

  const url = base + CHANNELS.map(ch => `&user_login=${ch}`).join("");

  const res = await fetch(url, {
    headers: {
      "Client-ID": CLIENT_ID,
      "Authorization": `Bearer ${token}`
    }
  });

  const data = await res.json();

  const live = data.data.map(stream => stream.user_login.toLowerCase());

  return live;
}

// ==========================================
// 📊 TRIER LES CHAÎNES ONLINE + OFFLINE
// ==========================================
function orderChannels(live) {
  const liveSet = new Set(live);

  let ordered = [];
  let added = new Set();

  function push(ch) {
    const id = ch.toLowerCase();
    if (!added.has(id)) {
      ordered.push(ch);
      added.add(id);
    }
  }

  // 1) D’abord : les live selon PRIORITY
  PRIORITY.forEach(ch => {
    if (liveSet.has(ch.toLowerCase())) push(ch);
  });

  // 2) Ensuite : les offline selon CHANNELS
  CHANNELS.forEach(ch => {
    if (!liveSet.has(ch.toLowerCase())) push(ch);
  });

  return ordered;
}

// ==========================================
// 🌐 ENDPOINT PRINCIPAL
// ==========================================
app.get("/live-order", async (req, res) => {
  try {
    const token = await getAccessToken();
    const live = await fetchLiveChannels(token);
    const ordered = orderChannels(live);

    res.json({
      live,
      ordered,
      countLive: live.length,
      timestamp: Date.now()
    });

  } catch (err) {
    console.error("Erreur API Twitch :", err);
    res.json({
      live: [],
      ordered: CHANNELS,
      error: "Twitch API unavailable"
    });
  }
});

// ==========================================
// 🚀 LANCER SERVEUR
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("CTC Twitch API running on port " + PORT);
});




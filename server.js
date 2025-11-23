import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ⚠️ Variables Render
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

/* ============================================================
   🔥 LISTE DES CHAÎNES SURVEILLÉES
   - facteurgeek ajouté en dernier
============================================================ */
const CHANNELS = [
  "valiv2",
  "crackthecode1",
  "dacemaster",
  "lesfaineants",
  "whiteshad0wz1989",
  "lyvickmax",
  "skyrroztv",
  "cohhcarnage",
  "lvndmark",
  "eslcs",
  "explorajeux",
  "facteurgeek"   // ⭐ en dernier, mais #1 si live
];

let accessToken = null;
let tokenExpiresAt = 0;

/* ============================================================
   GET TOKEN TWITCH
============================================================ */
async function getAccessToken() {
  const now = Date.now();
  if (accessToken && now < tokenExpiresAt) return accessToken;

  const params = new URLSearchParams();
  params.append("client_id", TWITCH_CLIENT_ID);
  params.append("client_secret", TWITCH_CLIENT_SECRET);
  params.append("grant_type", "client_credentials");

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    body: params
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error("❌ Erreur JSON token Twitch:", text);
    throw new Error("Réponse invalide de Twitch pour le token");
  }

  if (!res.ok) {
    console.error("❌ Erreur token Twitch:", data);
    throw new Error(data.message || "Impossible d'obtenir le token Twitch");
  }

  accessToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in - 60) * 1000;

  return accessToken;
}

/* ============================================================
   QUI EST LIVE ?
============================================================ */
async function getLiveStatus() {
  const token = await getAccessToken();

  const params = new URLSearchParams();
  CHANNELS.forEach(c => params.append("user_login", c));

  const res = await fetch(
    "https://api.twitch.tv/helix/streams?" + params.toString(),
    {
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        "Authorization": `Bearer ${token}`,
      }
    }
  );

  const text = await res.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error("❌ Erreur JSON Twitch /streams:", text);
    return [];
  }

  if (!res.ok) {
    console.error("❌ Erreur Twitch /streams:", data);
    return [];
  }

  if (!data || !Array.isArray(data.data)) {
    console.error("❌ Format Twitch inattendu:", data);
    return [];
  }

  return data.data.map(s => s.user_login.toLowerCase());
}

/* ============================================================
   BOOST EXPLORAJUEX
============================================================ */
function boostExploraIfLive(arr) {
  const SPECIAL = "explorajeux";
  const BEFORE_TARGETS = ["lvndmark", "eslcs"];

  if (!arr.includes(SPECIAL)) return arr;

  const boosted = arr.slice();
  const specialIndex = boosted.indexOf(SPECIAL);
  let targetIndex = null;

  for (const t of BEFORE_TARGETS) {
    const idx = boosted.indexOf(t);
    if (idx !== -1) {
      targetIndex = targetIndex === null ? idx : Math.min(targetIndex, idx);
    }
  }

  if (targetIndex === null || specialIndex < targetIndex) return boosted;

  boosted.splice(specialIndex, 1);
  boosted.splice(targetIndex, 0, SPECIAL);

  return boosted;
}

/* ============================================================
   ROUTE LIVE-ORDER
   🔥 RÈGLES :
   - facteurgeek = #1 absolu si live
   - sinon vali = #1 s’il est live
   - boost explorajeux conservé
   - live en premier, offline ensuite
============================================================ */
app.get("/live-order", async (req, res) => {
  try {
    const liveList = await getLiveStatus();

    const live = [];
    const offline = [];

    for (const ch of CHANNELS) {
      if (liveList.includes(ch.toLowerCase())) live.push(ch);
      else offline.push(ch);
    }

    const fg = "facteurgeek";
    const vali = "valiv2";

    let ordered = [];

    // 🔥 1) facteurgeek est live → #1 absolu
    if (liveList.includes(fg.toLowerCase())) {
      ordered = [
        fg,
        ...live.filter(c => c.toLowerCase() !== fg.toLowerCase()),
        ...offline.filter(c => c.toLowerCase() !== fg.toLowerCase())
      ];
    }

    // 🔥 2) facteurgeek N'EST PAS live → priorité Vali si live
    else if (liveList.includes(vali.toLowerCase())) {
      const liveNoVali = live.filter(c => c.toLowerCase() !== vali.toLowerCase());
      const boostedLive = boostExploraIfLive(liveNoVali);

      ordered = [
        vali,
        ...boostedLive,
        ...offline.filter(c => c.toLowerCase() !== vali.toLowerCase())
      ];
    }

    // 🔥 3) Aucun FG/Vali live → comportement normal
    else {
      const boostedLive = boostExploraIfLive(live);
      ordered = [
        ...boostedLive,
        ...offline
      ];
    }

    res.json({ ordered, live: liveList });

  } catch (err) {
    console.error("❌ Erreur /live-order:", err);
    res.status(500).json({
      error: "API error",
      detail: err.message || String(err)
    });
  }
});

/* ============================================================
   ROUTE TEST
============================================================ */
app.get("/", (req, res) => {
  res.send("CrackTheCode Twitch API OK");
});

/* ============================================================
   LANCEMENT SERVEUR
============================================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API running on port " + PORT));

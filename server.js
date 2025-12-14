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
   🔥 LISTE DES CHAÎNES SURVEILLÉES (MAJ)
   - retiré: lesfaineants, lyvickmax
   - ajouté: biggunner911
============================================================ */
const CHANNELS = [
  "valiv2",
  "crackthecode1",
  "dacemaster",
  "whiteshad0wz1989",
  "skyrroztv",
  "cohhcarnage",
  "biggunner911",     // ✅ AJOUTÉ
  "lvndmark",
  "eslcs",
  "explorajeux",
  "facteurgeek"
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

  return data.data.map(s => (s.user_login || "").toLowerCase());
}

/* ============================================================
   BOOST UN CHANNEL AVANT CERTAINS AUTRES (si présent)
============================================================ */
function boostIfPresent(arr, special, beforeTargets) {
  if (!arr.includes(special)) return arr;

  const boosted = arr.slice();
  const specialIndex = boosted.indexOf(special);
  let targetIndex = null;

  for (const t of beforeTargets) {
    const idx = boosted.indexOf(t);
    if (idx !== -1) {
      targetIndex = targetIndex === null ? idx : Math.min(targetIndex, idx);
    }
  }

  if (targetIndex === null || specialIndex < targetIndex) return boosted;

  boosted.splice(specialIndex, 1);
  boosted.splice(targetIndex, 0, special);

  return boosted;
}

/* ============================================================
   ROUTE LIVE-ORDER
   🔥 RÈGLES (MAJ)
   - 1) Vali #1 s'il est live
   - 2) Sinon crackthecode1 #1 s'il est live (donc FG ne te dépasse plus)
   - 3) Sinon comportement normal
   - Boost explorajeux + boost biggunner (devant lvndmark/eslcs) quand live
============================================================ */
app.get("/live-order", async (req, res) => {
  try {
    const liveList = await getLiveStatus(); // array en lowercase

    const live = [];
    const offline = [];

    for (const ch of CHANNELS) {
      if (liveList.includes(ch.toLowerCase())) live.push(ch);
      else offline.push(ch);
    }

    const vali = "valiv2";
    const ctc  = "crackthecode1";

    // Boosts dans la section LIVE (si présents)
    // 1) explorajeux devant lvndmark/eslcs
    // 2) biggunner911 devant lvndmark/eslcs
    function applyBoosts(liveArr) {
      let out = liveArr.slice();
      out = boostIfPresent(out, "explorajeux", ["lvndmark", "eslcs"]);
      out = boostIfPresent(out, "biggunner911", ["lvndmark", "eslcs"]);
      return out;
    }

    let ordered = [];

    // 🔥 1) Vali live -> #1
    if (liveList.includes(vali)) {
      const liveNoVali = live.filter(c => c.toLowerCase() !== vali);
      const boostedLive = applyBoosts(liveNoVali);

      ordered = [
        vali,
        ...boostedLive,
        ...offline.filter(c => c.toLowerCase() !== vali)
      ];
    }

    // 🔥 2) Sinon toi live -> #1 (empêche FG de te passer)
    else if (liveList.includes(ctc)) {
      const liveNoCtc = live.filter(c => c.toLowerCase() !== ctc);
      const boostedLive = applyBoosts(liveNoCtc);

      ordered = [
        ctc,
        ...boostedLive,
        ...offline.filter(c => c.toLowerCase() !== ctc)
      ];
    }

    // 🔥 3) Sinon normal
    else {
      const boostedLive = applyBoosts(live);
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

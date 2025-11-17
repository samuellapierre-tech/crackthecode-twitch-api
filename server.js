import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ⚠️ À configurer dans Render (Environment variables)
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

// Toutes tes chaînes, avec l'ordre de priorité de base
// (on va ensuite trier selon qui est live ou non)
const CHANNELS = [
  "valiv2",          // Vali - priorité absolue
  "crackthecode1",   // toi
  "whiteshad0wz1989",
  "lyvickmax",
  "skyrroztv",
  "cohhcarnage",
  "lvndmark",
  "eslcs",
  "explorajeux"
];

let accessToken = null;
let tokenExpiresAt = 0;

// Récupérer un token Twitch (client_credentials)
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

// Retourne la liste des chaînes qui sont live (en minuscules)
async function getLiveStatus() {
  const token = await getAccessToken();

  const params = new URLSearchParams();
  CHANNELS.forEach(c => params.append("user_login", c));

  const res = await fetch("https://api.twitch.tv/helix/streams?" + params.toString(), {
    headers: {
      "Client-ID": TWITCH_CLIENT_ID,
      "Authorization": `Bearer ${token}`,
    }
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error("❌ Erreur JSON Twitch /streams:", text);
    // On ne casse pas tout : on considère qu'il n'y a personne de live
    return [];
  }

  if (!res.ok) {
    console.error("❌ Erreur Twitch /streams:", data);
    // Pareil : pas de live si erreur
    return [];
  }

  if (!data || !Array.isArray(data.data)) {
    console.error("❌ Format inattendu Twitch /streams:", data);
    // Pas de tableau data.data → personne live
    return [];
  }

  // Ici seulement on fait .map, car on sait que data.data est un tableau
  return data.data.map(s => s.user_login.toLowerCase());
}

// Route principale : /live-order
app.get("/live-order", async (req, res) => {
  try {
    const liveList = await getLiveStatus();  // ex: ["valiv2","skyrroztv"]

    const live = [];
    const offline = [];

    // Sépare les chaînes live et offline en respectant l'ordre de CHANNELS
    for (const ch of CHANNELS) {
      if (liveList.includes(ch.toLowerCase())) live.push(ch);
      else offline.push(ch);
    }

    const vali = "valiv2";
    const liveNoVali = live.filter(c => c.toLowerCase() !== vali.toLowerCase());

    let ordered = [];

    if (liveList.includes(vali.toLowerCase())) {
      // 🎯 Vali est live → il est toujours #1
      ordered = [
        vali,
        ...liveNoVali,
        ...offline.filter(c => c.toLowerCase() !== vali.toLowerCase())
      ];
    } else {
      // Vali n'est pas live → on garde l'ordre: live d'abord, puis offline
      ordered = [...live, ...offline];
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

// Route simple de test
app.get("/", (req, res) => {
  res.send("CrackTheCode Twitch API OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API running on port " + PORT));


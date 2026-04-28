// ============================================================
// FOOTUR COACHING — Netlify Function
// Compatible Node 14+ — utilise https natif (pas fetch)
// ============================================================

const https = require("https");

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_HOST    = "api.brevo.com";

// IDs templates Brevo
const TEMPLATE_J0 = 1; // FOOTUR - J0 - Profil
const TEMPLATE_J3 = 4; // FOOTUR - J3 - Bezannes
const TEMPLATE_J7 = 3; // FOOTUR - J7 - Bilan
const LIST_ID     = 3; // Liste "FOOTUR Diagnostic"

// Helper HTTPS
function brevoRequest(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: BREVO_HOST,
      port: 443,
      path: `/v3${path}`,
      method: "POST",
      headers: {
        "accept":         "application/json",
        "content-type":   "application/json",
        "api-key":        BREVO_API_KEY,
        "content-length": Buffer.byteLength(payload)
      }
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: "Method Not Allowed" };
  }

  const params    = new URLSearchParams(event.body);
  const prenom    = params.get("prenom")    || "";
  const email     = params.get("email")     || "";
  const telephone = params.get("telephone") || "";
  const profil    = params.get("profil")    || "F";

  if (!email || !prenom) {
    return { statusCode: 400, headers: corsHeaders, body: "Prénom et email requis." };
  }

  const profilUrl = `https://footur-academy.com/profil?nom=${encodeURIComponent(prenom)}&profil=${profil}`;
  const profilNoms = { M: "Le Moteur Coupé", F: "Le Fantôme", C: "Le Crispé", S: "Le Solo", G: "Le Gros Potentiel" };
  const profilNom = profilNoms[profil] || profil;

  try {
    // 1. Créer contact Brevo
    const contactResult = await brevoRequest("/contacts", {
      email,
      updateEnabled: true,
      attributes: { PRENOM: prenom, TELEPHONE: telephone, PROFIL_CODE: profil, PROFIL_NOM: profilNom, PROFIL_URL: profilUrl },
      listIds: [LIST_ID]
    });
    console.log("Contact →", contactResult.status, JSON.stringify(contactResult.body));

    // 2. Envoyer email J0
    const emailResult = await brevoRequest("/smtp/email", {
      templateId: TEMPLATE_J0,
      sender: { name: "Coach Selim — FOOTUR", email: "selim@footur-academy.com" },
      to: [{ email, name: prenom }],
      params: { PRENOM: prenom, PROFIL_NOM: profilNom, PROFIL_URL: profilUrl }
    });
    console.log("Email J0 →", emailResult.status, JSON.stringify(emailResult.body));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, contact: contactResult.status, email: emailResult.status })
    };

  } catch (err) {
    console.error("Erreur:", err.message);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
  }
};

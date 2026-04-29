// ============================================================
// FOOTUR COACHING — Netlify Function
// Node 18 natif — fetch API
// ============================================================

const BREVO_URL     = "https://api.brevo.com/v3";
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const TEMPLATE_J0   = 1;  // FOOTUR - J0 - Profil
const LIST_ID       = 3;  // FOOTUR Diagnostic

const PROFIL_NOMS = {
  M: "Le Moteur Coupé",
  F: "Le Fantôme",
  C: "Le Crispé",
  S: "Le Solo",
  G: "Le Gros Potentiel"
};

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

exports.handler = async (event) => {

  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS, body: "Method Not Allowed" };
  }

  // Parse
  const p         = new URLSearchParams(event.body);
  const prenom    = (p.get("prenom")    || "").trim();
  const email     = (p.get("email")     || "").trim();
  const telephone = (p.get("telephone") || "").trim();
  const profil    = (p.get("profil")    || "F").trim().toUpperCase();

  console.log("[FOOTUR] Données reçues:", { prenom, email, profil });

  if (!email || !prenom) {
    return { statusCode: 400, headers: CORS, body: "Prénom et email requis." };
  }

  if (!BREVO_API_KEY) {
    console.error("[FOOTUR] BREVO_API_KEY manquante !");
    return { statusCode: 500, headers: CORS, body: "Configuration manquante." };
  }

  const profilNom = PROFIL_NOMS[profil] || "Le Fantôme";
  const profilUrl = `https://footur-academy.com/profil?nom=${encodeURIComponent(prenom)}&profil=${profil}`;

  // ── 1. CRÉER CONTACT BREVO ──────────────────────────────
  let contactStatus = 0;
  try {
    const res = await fetch(`${BREVO_URL}/contacts`, {
      method: "POST",
      headers: {
        "accept":       "application/json",
        "content-type": "application/json",
        "api-key":      BREVO_API_KEY
      },
      body: JSON.stringify({
        email,
        updateEnabled: true,
        attributes: {
          PRENOM:      prenom,
          TELEPHONE:   telephone,
          PROFIL_CODE: profil,
          PROFIL_NOM:  profilNom,
          PROFIL_URL:  profilUrl
        },
        listIds: [LIST_ID]
      })
    });
    const data = await res.json();
    contactStatus = res.status;
    console.log("[FOOTUR] Contact Brevo →", res.status, JSON.stringify(data));
  } catch (err) {
    console.error("[FOOTUR] Erreur contact:", err.message);
  }

  // ── 2. ENVOYER EMAIL J0 ─────────────────────────────────
  let emailStatus = 0;
  try {
    const res = await fetch(`${BREVO_URL}/smtp/email`, {
      method: "POST",
      headers: {
        "accept":       "application/json",
        "content-type": "application/json",
        "api-key":      BREVO_API_KEY
      },
      body: JSON.stringify({
        templateId: TEMPLATE_J0,
        sender: {
          name:  "Coach Selim — FOOTUR",
          email: "selim@footur-academy.com"
        },
        to: [{ email, name: prenom }],
        params: {
          PRENOM:     prenom,
          PROFIL_NOM: profilNom,
          PROFIL_URL: profilUrl
        }
      })
    });
    const data = await res.json();
    emailStatus = res.status;
    console.log("[FOOTUR] Email J0 →", res.status, JSON.stringify(data));
  } catch (err) {
    console.error("[FOOTUR] Erreur email:", err.message);
  }

  // ── 3. RÉPONSE ──────────────────────────────────────────
  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      success:       true,
      contactStatus,
      emailStatus,
      profilUrl
    })
  };
};

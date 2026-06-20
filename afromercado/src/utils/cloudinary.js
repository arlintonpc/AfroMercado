// ============================================================
//  Subida de imágenes a Cloudinary vía API REST firmada.
//  No requiere SDK ni dependencias: usa crypto + fetch nativos.
//
//  Si CLOUDINARY_URL no está definido, las funciones devuelven null
//  y el llamador usa el disco local como respaldo.
// ============================================================
const crypto = require("crypto");
const fs = require("fs");

/** Parsea CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name */
function parseConfig() {
  const url = process.env.CLOUDINARY_URL;
  if (!url) return null;
  const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) return null;
  return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
}

/** ¿Cloudinary está configurado? */
function cloudinaryActivo() {
  return !!parseConfig();
}

/**
 * Sube un archivo local a Cloudinary y devuelve la secure_url.
 * Devuelve null si no está configurado o si falla (para usar fallback local).
 */
async function subirACloudinary(rutaArchivo, carpeta = "afromercado/productos") {
  const cfg = parseConfig();
  if (!cfg) return null;

  try {
    const buffer = fs.readFileSync(rutaArchivo);
    const timestamp = Math.floor(Date.now() / 1000);
    // Firma: parámetros (sin file/api_key) ordenados alfabéticamente + secret
    const toSign = `folder=${carpeta}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash("sha1")
      .update(toSign + cfg.apiSecret)
      .digest("hex");

    const fd = new FormData();
    fd.append("file", new Blob([buffer]), "upload");
    fd.append("api_key", cfg.apiKey);
    fd.append("timestamp", String(timestamp));
    fd.append("folder", carpeta);
    fd.append("signature", signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`,
      { method: "POST", body: fd }
    );
    const j = await res.json();
    if (j.secure_url) return j.secure_url;

    console.error("[Cloudinary] error de subida:", JSON.stringify(j.error || j));
    return null;
  } catch (e) {
    console.error("[Cloudinary] excepción:", e.message);
    return null;
  }
}

module.exports = { subirACloudinary, cloudinaryActivo };

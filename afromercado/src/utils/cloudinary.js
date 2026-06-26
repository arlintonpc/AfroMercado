// ============================================================
//  Subida de archivos a Cloudinary via API REST firmada.
//  No requiere SDK ni dependencias: usa crypto + fetch nativos.
//
//  Si CLOUDINARY_URL no esta definido, las funciones devuelven null
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

/** ¿Cloudinary esta configurado? */
function cloudinaryActivo() {
  return !!parseConfig();
}

function firmarCampos(campos, apiSecret) {
  const serializados = Object.keys(campos)
    .sort()
    .map((clave) => `${clave}=${campos[clave]}`)
    .join("&");
  return crypto.createHash("sha1").update(serializados + apiSecret).digest("hex");
}

function construirUrlDerivada(secureUrl, transformacion, extension = null) {
  if (!secureUrl) return null;

  const marcador = "/upload/";
  const idx = secureUrl.indexOf(marcador);
  if (idx === -1) return secureUrl;

  const cabeza = secureUrl.slice(0, idx + marcador.length);
  const cola = secureUrl.slice(idx + marcador.length);
  let url = `${cabeza}${transformacion ? `${transformacion}/` : ""}${cola}`;

  if (extension) {
    url = url.replace(/\.[a-z0-9]+(\?.*)?$/i, `.${extension}$1`);
  }

  return url;
}

function formatearSegundo(valor) {
  const numero = Math.max(0, Math.round(Number(valor) * 1000) / 1000);
  return Number.isInteger(numero)
    ? String(numero)
    : numero.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function construirTransformacionVideo(recorte = null) {
  const partes = [];
  if (recorte?.tieneRecorte) {
    partes.push(`so_${formatearSegundo(recorte.inicio)}`);
    partes.push(`du_${formatearSegundo(recorte.duracionFinal)}`);
  }
  partes.push("f_mp4", "q_auto", "w_960");
  return partes.join(",");
}

function construirUrlVideoOptimizada(secureUrl, recorte = null) {
  return construirUrlDerivada(secureUrl, construirTransformacionVideo(recorte));
}

function construirPosterVideo(secureUrl, recorte = null) {
  const segundo = recorte?.tieneRecorte
    ? recorte.inicio + Math.min(1, Math.max(recorte.duracionFinal / 2, 0))
    : 1;
  return construirUrlDerivada(secureUrl, `so_${formatearSegundo(segundo)}`, "jpg");
}

async function subirArchivoACloudinary(
  rutaArchivo,
  { carpeta = "afromercado/productos", resourceType = "image" } = {},
) {
  const cfg = parseConfig();
  if (!cfg) return null;

  try {
    const buffer = fs.readFileSync(rutaArchivo);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = firmarCampos({ folder: carpeta, timestamp }, cfg.apiSecret);

    const fd = new FormData();
    fd.append("file", new Blob([buffer]), "upload");
    fd.append("api_key", cfg.apiKey);
    fd.append("timestamp", String(timestamp));
    fd.append("folder", carpeta);
    fd.append("signature", signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cfg.cloudName}/${resourceType}/upload`,
      { method: "POST", body: fd },
    );

    const j = await res.json();
    if (j?.secure_url) return j;

    console.error("[Cloudinary] error de subida:", JSON.stringify(j?.error || j));
    return null;
  } catch (e) {
    console.error("[Cloudinary] excepcion:", e.message);
    return null;
  }
}

/**
 * Sube un archivo local a Cloudinary y devuelve la secure_url.
 * Devuelve null si no esta configurado o si falla (para usar fallback local).
 */
async function subirACloudinary(rutaArchivo, carpeta = "afromercado/productos") {
  const subida = await subirArchivoACloudinary(rutaArchivo, { carpeta, resourceType: "image" });
  return subida?.secure_url ?? null;
}

/**
 * Sube un video a Cloudinary y devuelve URLs derivadas y metadatos.
 * Devuelve null si no esta configurado o si falla.
 */
async function subirVideoACloudinary(rutaArchivo, carpeta = "afromercado/videos") {
  const subida = await subirArchivoACloudinary(rutaArchivo, { carpeta, resourceType: "video" });
  if (!subida?.secure_url) return null;

  return {
    secureUrl: subida.secure_url,
    optimizedUrl: construirUrlVideoOptimizada(subida.secure_url),
    posterUrl: construirPosterVideo(subida.secure_url),
    publicId: subida.public_id ?? null,
    format: subida.format ?? null,
    resourceType: subida.resource_type ?? "video",
    duration: typeof subida.duration === "number" ? subida.duration : null,
    width: typeof subida.width === "number" ? subida.width : null,
    height: typeof subida.height === "number" ? subida.height : null,
    bytes: typeof subida.bytes === "number" ? subida.bytes : null,
    mimeType: subida.format ? `video/${subida.format}` : null,
  };
}

async function eliminarDeCloudinary(publicId, resourceType = "video") {
  const cfg = parseConfig();
  if (!cfg || !publicId) return false;

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = firmarCampos({ public_id: publicId, timestamp }, cfg.apiSecret);

    const fd = new FormData();
    fd.append("public_id", publicId);
    fd.append("api_key", cfg.apiKey);
    fd.append("timestamp", String(timestamp));
    fd.append("signature", signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cfg.cloudName}/${resourceType}/destroy`,
      { method: "POST", body: fd },
    );
    const j = await res.json();
    return j?.result === "ok" || j?.result === "not found";
  } catch (e) {
    console.error("[Cloudinary] error al eliminar:", e.message);
    return false;
  }
}

module.exports = {
  subirACloudinary,
  subirVideoACloudinary,
  eliminarDeCloudinary,
  cloudinaryActivo,
  construirUrlDerivada,
  construirUrlVideoOptimizada,
  construirPosterVideo,
};

const fs = require("fs");
const crypto = require("crypto");

const MIME_PERMITIDOS = new Set(["image/jpeg", "image/png"]);
const MIN_BYTES = 40 * 1024;
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_LADO_CORTO = 360;
const MIN_LADO_LARGO = 600;
const MAX_RELACION_LADOS = 2.8;

function dimensionesPng(buffer) {
  if (buffer.length < 24) return null;
  const firmaPng = buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
  if (!firmaPng) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function dimensionesJpeg(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  const marcadoresSof = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);

  while (offset < buffer.length - 9) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;

    if (marcadoresSof.has(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + length;
  }

  return null;
}

function leerDimensiones(ruta, mimetype) {
  const buffer = fs.readFileSync(ruta);
  if (mimetype === "image/png") return dimensionesPng(buffer);
  if (mimetype === "image/jpeg") return dimensionesJpeg(buffer);
  return null;
}

function hashArchivo(ruta) {
  return crypto.createHash("sha256").update(fs.readFileSync(ruta)).digest("hex");
}

function validarDocumentoImagen(file) {
  if (!file) {
    return { ok: false, mensaje: "No se recibio imagen del documento." };
  }

  if (!MIME_PERMITIDOS.has(file.mimetype)) {
    return {
      ok: false,
      mensaje: "Sube una foto real del documento en JPG o PNG. No se aceptan logos, PDFs, capturas ni otros archivos.",
    };
  }

  if (file.size < MIN_BYTES) {
    return {
      ok: false,
      mensaje: "La imagen parece demasiado liviana para ser una foto legible del documento. Toma una foto clara y completa.",
    };
  }

  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      mensaje: "La foto supera 5 MB. Comprimela o toma una nueva foto con buena luz.",
    };
  }

  const dimensiones = leerDimensiones(file.path, file.mimetype);
  if (!dimensiones?.width || !dimensiones?.height) {
    return {
      ok: false,
      mensaje: "No pudimos leer la imagen. Sube una foto JPG o PNG tomada con la camara.",
    };
  }

  const ladoCorto = Math.min(dimensiones.width, dimensiones.height);
  const ladoLargo = Math.max(dimensiones.width, dimensiones.height);
  if (ladoCorto < MIN_LADO_CORTO || ladoLargo < MIN_LADO_LARGO) {
    return {
      ok: false,
      mensaje: "La foto no tiene suficiente resolucion para revisar el documento. Debe verse completa y legible.",
    };
  }

  if (ladoLargo / ladoCorto > MAX_RELACION_LADOS) {
    return {
      ok: false,
      mensaje: "La imagen tiene un recorte inusual. Sube una foto completa del documento, sin recortar los bordes.",
    };
  }

  return {
    ok: true,
    width: dimensiones.width,
    height: dimensiones.height,
    bytes: file.size,
    mimetype: file.mimetype,
  };
}

module.exports = {
  hashArchivo,
  validarDocumentoImagen,
};

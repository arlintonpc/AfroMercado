// ============================================================
//  Utilidades de autenticación
//  - Hashing de contraseñas con bcrypt (nunca texto plano)
//  - Generación y verificación de tokens JWT
// ============================================================
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { ErrorNoAutorizado } = require("./errores");

async function hashearPassword(passwordPlano) {
  return bcrypt.hash(passwordPlano, config.bcryptRounds);
}

async function compararPassword(passwordPlano, hash) {
  return bcrypt.compare(passwordPlano, hash);
}

function generarToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiraEn });
}

function verificarToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (e) {
    throw new ErrorNoAutorizado("Token inválido o expirado");
  }
}

module.exports = { hashearPassword, compararPassword, generarToken, verificarToken };

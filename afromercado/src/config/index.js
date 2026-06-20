// Configuración central — lee variables de entorno de forma segura
require("dotenv").config();

function requerido(nombre, valorPorDefecto = undefined) {
  const valor = process.env[nombre] ?? valorPorDefecto;
  if (valor === undefined) {
    throw new Error(`Falta la variable de entorno requerida: ${nombre}`);
  }
  return valor;
}

const config = {
  entorno: process.env.NODE_ENV || "development",
  puerto: parseInt(process.env.PORT || "3000", 10),

  jwt: {
    secret: requerido("JWT_SECRET"),
    expiraEn: process.env.JWT_EXPIRES_IN || "24h",
  },

  // Comisión de AfroMercado (10%)
  comisionPorcentaje: parseFloat(process.env.COMISION_PORCENTAJE || "0.10"),

  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "10", 10),
};

module.exports = config;

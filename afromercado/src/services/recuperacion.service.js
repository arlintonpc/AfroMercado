const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const TokenRecuperacionRepository = require("../repositories/token-recuperacion.repository");
const SesionResetRepository = require("../repositories/sesion-reset.repository");
const UsuarioRepository = require("../repositories/usuario.repository");
const { enviarEmail } = require("../utils/email");
const { codigoRecuperacion } = require("../utils/templates/email-recuperacion");
const { ErrorValidacion, ErrorNoAutorizado } = require("../utils/errores");
const config = require("../config");

const RESPUESTA_GENERICA = "Si ese correo está registrado, recibirás un código en los próximos minutos.";
const MAX_INTENTOS_CODIGO = 5;
const MAX_CODIGOS_POR_HORA = 3;
const DURACION_CODIGO_MS = 10 * 60 * 1000; // 10 minutos
const DURACION_RESET_SESSION_MS = 15 * 60 * 1000; // 15 minutos

const RecuperacionService = {
  async solicitarCodigo(email) {
    // Buscar usuario — si no existe, responder igual para no revelar
    const usuario = await UsuarioRepository.buscarPorEmail(email).catch(() => null);

    // Bloquear admins (misma respuesta genérica — no revelar que existe ni que está bloqueado)
    if (usuario && usuario.rol === "ADMIN") {
      return { mensaje: RESPUESTA_GENERICA };
    }

    if (usuario) {
      // Verificar rate limit: máximo 3 códigos por hora
      const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000);
      const recientes = await TokenRecuperacionRepository.contarRecientes(usuario.id, haceUnaHora);
      if (recientes >= MAX_CODIGOS_POR_HORA) {
        throw new ErrorValidacion("Has solicitado demasiados códigos. Espera unos minutos antes de intentar de nuevo.");
      }

      // Generar código OTP
      const codigo = crypto.randomInt(100000, 999999).toString();
      const codigoHash = await bcrypt.hash(codigo, 8);
      const expiresAt = new Date(Date.now() + DURACION_CODIGO_MS);

      // Reemplazar tokens anteriores activos
      await TokenRecuperacionRepository.marcarReemplazados(usuario.id);

      // Guardar nuevo token
      await TokenRecuperacionRepository.crear({ usuarioId: usuario.id, codigoHash, expiresAt });

      // Enviar email (fire and forget)
      setImmediate(() => {
        enviarEmail({
          to: usuario.email,
          subject: "Código de recuperación — AfroMercado",
          html: codigoRecuperacion({ nombre: usuario.nombre, codigo }),
        }).catch((err) => console.error("[NOTIF] Error enviando código recuperación:", err.message));
      });
    }

    return { mensaje: RESPUESTA_GENERICA };
  },

  async verificarCodigo(email, codigo) {
    const usuario = await UsuarioRepository.buscarPorEmail(email).catch(() => null);
    if (!usuario) throw new ErrorValidacion("Código inválido o expirado.");

    const token = await TokenRecuperacionRepository.buscarActivoPorUsuario(usuario.id);
    if (!token) throw new ErrorValidacion("El código es inválido o ya expiró. Solicita uno nuevo.");

    if (token.intentos >= MAX_INTENTOS_CODIGO) {
      throw new ErrorValidacion("Demasiados intentos fallidos. Solicita un nuevo código.");
    }

    const coincide = await bcrypt.compare(codigo, token.codigoHash);
    if (!coincide) {
      await TokenRecuperacionRepository.incrementarIntentos(token.id);
      const restantes = MAX_INTENTOS_CODIGO - token.intentos - 1;
      throw new ErrorValidacion(`Código incorrecto. Te quedan ${restantes} intento${restantes !== 1 ? "s" : ""}.`);
    }

    // Código correcto — marcar como usado
    await TokenRecuperacionRepository.marcarUsado(token.id);

    // Crear sesión de reset
    const tokenResetRaw = crypto.randomBytes(32).toString("hex");
    const tokenResetHash = await bcrypt.hash(tokenResetRaw, 8);
    const expiresAt = new Date(Date.now() + DURACION_RESET_SESSION_MS);
    const sesion = await SesionResetRepository.crear({ usuarioId: usuario.id, tokenHash: tokenResetHash, expiresAt });

    // JWT que envuelve el id de la sesión para lookup seguro
    const resetToken = jwt.sign(
      { sesionResetId: sesion.id, usuarioId: usuario.id },
      config.jwt.secret,
      { expiresIn: "15m" }
    );

    return { resetToken };
  },

  async cambiarPassword(resetToken, nuevaPassword) {
    if (!resetToken) throw new ErrorValidacion("Token de reset inválido.");
    if (!nuevaPassword || nuevaPassword.length < 6) {
      throw new ErrorValidacion("La contraseña debe tener al menos 6 caracteres.");
    }

    // Verificar JWT
    let payload;
    try {
      payload = jwt.verify(resetToken, config.jwt.secret);
    } catch {
      throw new ErrorValidacion("El enlace de recuperación es inválido o expiró.");
    }

    const { sesionResetId, usuarioId } = payload;

    // Verificar SesionReset en BD
    const sesion = await SesionResetRepository.buscarActiva(sesionResetId);
    if (!sesion || sesion.usuarioId !== usuarioId) {
      throw new ErrorValidacion("El enlace de recuperación ya fue usado o expiró.");
    }

    // Hashear nueva contraseña
    const passwordHash = await bcrypt.hash(nuevaPassword, config.bcryptRounds);

    // Actualizar en BD (transacción)
    const prisma = require("../config/prisma");
    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: usuarioId },
        data: { passwordHash, passwordCambiadoAt: new Date() },
      }),
      prisma.sesionReset.update({
        where: { id: sesionResetId },
        data: { usadoEn: new Date() },
      }),
    ]);

    return { mensaje: "Contraseña actualizada exitosamente. Ya puedes iniciar sesión." };
  },
};

module.exports = RecuperacionService;

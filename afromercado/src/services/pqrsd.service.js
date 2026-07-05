const PqrsdRepository = require("../repositories/pqrsd.repository");
const { ErrorValidacion, ErrorNoEncontrado, ErrorProhibido } = require("../utils/errores");
const NotificacionService = require("./notificacion.service");

const TIPOS_VALIDOS = ["PETICION", "QUEJA", "RECLAMO", "SUGERENCIA", "DENUNCIA"];

const PqrsdService = {
  async crear(usuario, { nombreContacto, emailContacto, telefonoContacto, tipo, asunto, mensaje, moduloRelacionado, referenciaId }) {
    if (!TIPOS_VALIDOS.includes(tipo)) {
      throw new ErrorValidacion(`Tipo inválido. Opciones: ${TIPOS_VALIDOS.join(", ")}`);
    }
    if (!nombreContacto?.trim() || !emailContacto?.trim()) {
      throw new ErrorValidacion("El nombre y el correo de contacto son obligatorios");
    }
    if (!asunto?.trim() || !mensaje?.trim()) {
      throw new ErrorValidacion("El asunto y el mensaje son obligatorios");
    }

    const pqrsd = await PqrsdRepository.crear({
      usuarioId: usuario?.id ?? null,
      nombreContacto: nombreContacto.trim(),
      emailContacto: emailContacto.trim(),
      telefonoContacto: telefonoContacto?.trim() || null,
      tipo,
      asunto: asunto.trim(),
      mensaje: mensaje.trim(),
      moduloRelacionado: moduloRelacionado?.trim() || null,
      referenciaId: referenciaId != null ? Number(referenciaId) : null,
    });

    NotificacionService.pqrsdCreado({ pqrsd }).catch((e) => console.error("[PQRSD] notificar creación:", e.message));
    return pqrsd;
  },

  async listarPorUsuario(usuarioId) {
    return PqrsdRepository.listarPorUsuario(usuarioId);
  },

  async listarAdmin(filtros) {
    return PqrsdRepository.listarAdmin(filtros);
  },

  async responder(adminId, pqrsdId, respuesta) {
    if (!respuesta?.trim()) throw new ErrorValidacion("La respuesta no puede estar vacía");
    const existente = await PqrsdRepository.buscarPorId(pqrsdId);
    if (!existente) throw new ErrorNoEncontrado("Ticket no encontrado");
    const actualizado = await PqrsdRepository.responder(pqrsdId, { respuesta: respuesta.trim(), respondidoPor: adminId });
    NotificacionService.pqrsdRespondido({ pqrsd: actualizado }).catch((e) => console.error("[PQRSD] notificar respuesta:", e.message));
    return actualizado;
  },

  async cerrar(adminId, pqrsdId) {
    const existente = await PqrsdRepository.buscarPorId(pqrsdId);
    if (!existente) throw new ErrorNoEncontrado("Ticket no encontrado");
    return PqrsdRepository.cerrar(pqrsdId, adminId);
  },

  async obtenerDetalle(pqrsdId, usuario) {
    const pqrsd = await PqrsdRepository.buscarPorId(pqrsdId);
    if (!pqrsd) throw new ErrorNoEncontrado("Ticket no encontrado");
    const esDueno = pqrsd.usuarioId && pqrsd.usuarioId === usuario?.id;
    const esAdmin = usuario?.rol === "ADMIN";
    if (!esDueno && !esAdmin) throw new ErrorProhibido("No tienes acceso a este ticket");
    return pqrsd;
  },
};

module.exports = PqrsdService;

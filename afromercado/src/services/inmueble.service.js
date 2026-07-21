// ============================================================
//  Servicio de Bienes Raíces / Inmuebles (vitrina, sin transacción)
//  Vitrina de predios formalizados — NO hay compra/venta ni checkout dentro
//  de la plataforma; el contacto siempre es por WhatsApp. A diferencia de
//  Empleo, la moderación NUNCA se salta: un admin siempre debe verificar el
//  documento de soporte antes de aprobar (nunca auto-aprobación), dado el
//  riesgo de tierra en disputa / informalidad de tenencia en el territorio
//  piloto (ver Capítulo 3 del Proyecto Maestro).
// ============================================================
const InmuebleRepository = require("../repositories/inmueble.repository");
const ComercioRepository = require("../repositories/comercio.repository");
const UsuarioService = require("./usuario.service");
const { ErrorValidacion, ErrorNoEncontrado, ErrorProhibido } = require("../utils/errores");
const { validarUbicacion } = require("../utils/ubicacion");

const TIPOS_INMUEBLE = ["LOTE", "CASA", "APARTAMENTO", "FINCA", "LOCAL_COMERCIAL", "BODEGA", "OTRO"];
const TIPOS_OPERACION = ["VENTA", "ARRIENDO"];
const MOTIVOS_DENUNCIA = ["PUBLICACION_FALSA", "TIERRA_EN_DISPUTA", "ESTAFA_DINERO", "DOCUMENTO_FALSO", "CONTENIDO_INAPROPIADO", "OTRO"];
const TRANSICIONES_ESTADO = {
  BORRADOR: ["PUBLICADO"],
  PUBLICADO: ["PAUSADO", "CERRADO"],
  PAUSADO: ["PUBLICADO", "CERRADO"],
  CERRADO: [],
};

function validarDatosInmueble(datos) {
  if (!datos.titulo?.trim()) throw new ErrorValidacion("El título es obligatorio");
  if (!TIPOS_INMUEBLE.includes(datos.tipoInmueble)) {
    throw new ErrorValidacion(`Tipo de inmueble inválido. Opciones: ${TIPOS_INMUEBLE.join(", ")}`);
  }
  if (!TIPOS_OPERACION.includes(datos.tipoOperacion)) {
    throw new ErrorValidacion(`Tipo de operación inválido. Opciones: ${TIPOS_OPERACION.join(", ")}`);
  }
  if (datos.precio == null || Number.isNaN(Number(datos.precio)) || Number(datos.precio) <= 0) {
    throw new ErrorValidacion("El precio es obligatorio y debe ser mayor a cero");
  }
  if (!datos.departamento?.trim()) throw new ErrorValidacion("El departamento es obligatorio");
  if (!datos.municipio?.trim()) throw new ErrorValidacion("El municipio es obligatorio");
  validarUbicacion(datos.departamento.trim(), datos.municipio.trim());
}

const InmuebleService = {
  // ── Inmuebles ────────────────────────────────────────────────
  async crear(usuarioId, datos) {
    validarDatosInmueble(datos);

    // El publicador puede tener su propio comercio (comerciante) — si lo tiene, la
    // publicación queda vinculada automáticamente. A diferencia de Empleo, tener un
    // comercio verificado NUNCA salta la moderación: el admin siempre debe revisar
    // el documento de soporte antes de aprobar.
    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);

    return InmuebleRepository.crear({
      publicadorId: usuarioId,
      comercioId: comercio ? comercio.id : null,
      titulo: datos.titulo.trim(),
      descripcion: datos.descripcion?.trim() || null,
      tipoInmueble: datos.tipoInmueble,
      tipoOperacion: datos.tipoOperacion,
      precio: Number(datos.precio),
      areaM2: datos.areaM2 != null ? Number(datos.areaM2) : null,
      habitaciones: datos.habitaciones != null ? Number(datos.habitaciones) : null,
      banos: datos.banos != null ? Number(datos.banos) : null,
      departamento: datos.departamento.trim(),
      municipio: datos.municipio.trim(),
      vereda: datos.vereda?.trim() || null,
      direccionReferencia: datos.direccionReferencia?.trim() || null,
      latitud: datos.latitud != null ? Number(datos.latitud) : null,
      longitud: datos.longitud != null ? Number(datos.longitud) : null,
      folioMatricula: datos.folioMatricula?.trim() || null,
      contactoWhatsapp: datos.contactoWhatsapp?.trim() || null,
    });
  },

  async _obtenerPropio(usuarioId, inmuebleId) {
    const inmueble = await InmuebleRepository.buscarPorId(inmuebleId);
    if (!inmueble || inmueble.deletedAt) throw new ErrorNoEncontrado("Inmueble no encontrado");
    if (inmueble.publicadorId !== usuarioId) throw new ErrorProhibido("No puedes modificar esta publicación");
    return inmueble;
  },

  async actualizar(usuarioId, inmuebleId, datos) {
    const inmueble = await this._obtenerPropio(usuarioId, inmuebleId);
    if (inmueble.estado !== "BORRADOR") {
      throw new ErrorValidacion("Solo puedes editar el contenido mientras la publicación está en borrador");
    }
    validarDatosInmueble({ ...inmueble, ...datos });
    const campos = {};
    for (const campo of [
      "titulo", "descripcion", "tipoInmueble", "tipoOperacion", "departamento", "municipio",
      "vereda", "direccionReferencia", "folioMatricula", "contactoWhatsapp",
    ]) {
      if (datos[campo] !== undefined) campos[campo] = typeof datos[campo] === "string" ? datos[campo].trim() : datos[campo];
    }
    if (datos.precio !== undefined) campos.precio = Number(datos.precio);
    if (datos.areaM2 !== undefined) campos.areaM2 = datos.areaM2 != null ? Number(datos.areaM2) : null;
    if (datos.habitaciones !== undefined) campos.habitaciones = datos.habitaciones != null ? Number(datos.habitaciones) : null;
    if (datos.banos !== undefined) campos.banos = datos.banos != null ? Number(datos.banos) : null;
    if (datos.latitud !== undefined) campos.latitud = datos.latitud != null ? Number(datos.latitud) : null;
    if (datos.longitud !== undefined) campos.longitud = datos.longitud != null ? Number(datos.longitud) : null;
    return InmuebleRepository.actualizar(inmuebleId, campos);
  },

  async cambiarEstado(usuarioId, inmuebleId, nuevoEstado) {
    const inmueble = await this._obtenerPropio(usuarioId, inmuebleId);
    const permitidos = TRANSICIONES_ESTADO[inmueble.estado] || [];
    if (!permitidos.includes(nuevoEstado)) {
      throw new ErrorValidacion(`No puedes pasar de ${inmueble.estado} a ${nuevoEstado}`);
    }
    // Nota: se puede pasar a PUBLICADO sin documento de soporte (queda esperando
    // revisión), pero el admin nunca podrá aprobarla hasta que se adjunte uno
    // (ver InmuebleService.moderar — REGLA CRÍTICA).
    return InmuebleRepository.actualizar(inmuebleId, { estado: nuevoEstado });
  },

  async eliminar(usuarioId, inmuebleId) {
    await this._obtenerPropio(usuarioId, inmuebleId);
    return InmuebleRepository.actualizar(inmuebleId, { deletedAt: new Date(), estado: "CERRADO" });
  },

  async guardarFoto(usuarioId, inmuebleId, url) {
    const inmueble = await this._obtenerPropio(usuarioId, inmuebleId);
    const fotoUrls = [...(inmueble.fotoUrls || []), url];
    return InmuebleRepository.actualizar(inmuebleId, { fotoUrls });
  },

  async guardarDocumentoSoporte(usuarioId, inmuebleId, url) {
    await this._obtenerPropio(usuarioId, inmuebleId);
    return InmuebleRepository.actualizar(inmuebleId, { documentoSoporteUrl: url });
  },

  // El documento de soporte (evidencia de título) es privado — solo lo ve el
  // propio publicador y un admin, nunca el público. Se elimina explícitamente
  // de cualquier respuesta pública, aunque el repositorio no lo excluya.
  async listarPublicos(filtros) {
    const resultado = await InmuebleRepository.listarPublicos(filtros);
    return { ...resultado, items: resultado.items.map(({ documentoSoporteUrl, ...resto }) => resto) };
  },

  async obtenerDetallePublico(inmuebleId) {
    const inmueble = await InmuebleRepository.buscarPorId(inmuebleId);
    if (!inmueble || inmueble.deletedAt || inmueble.estado !== "PUBLICADO" || inmueble.estadoModeracion !== "APROBADA") {
      throw new ErrorNoEncontrado("Inmueble no encontrado");
    }
    const { documentoSoporteUrl, ...publico } = inmueble;
    return publico;
  },

  async misPublicaciones(usuarioId) {
    return InmuebleRepository.listarPorPublicador(usuarioId);
  },

  // ── Moderación (admin) ───────────────────────────────────────
  async listarPendientesModeracion() {
    return InmuebleRepository.listarPendientesModeracion();
  },

  // REGLA CRÍTICA: nunca se puede aprobar una publicación sin documento de
  // soporte (evidencia de título) — a diferencia de Empleo, aquí no existe
  // ninguna vía de auto-aprobación.
  async moderar(adminId, inmuebleId, { accion, motivo }) {
    if (!["APROBAR", "RECHAZAR"].includes(accion)) throw new ErrorValidacion("Acción inválida");
    const inmueble = await InmuebleRepository.buscarPorId(inmuebleId);
    if (!inmueble) throw new ErrorNoEncontrado("Inmueble no encontrado");
    if (accion === "APROBAR" && !inmueble.documentoSoporteUrl) {
      throw new ErrorValidacion("No se puede aprobar sin documento de soporte");
    }
    return InmuebleRepository.actualizar(inmuebleId, {
      estadoModeracion: accion === "APROBAR" ? "APROBADA" : "RECHAZADA",
      revisadoPor: adminId,
      revisadoAt: new Date(),
      motivoRechazoModeracion: accion === "RECHAZAR" ? motivo?.trim() || null : null,
    });
  },

  // ── Denuncias ─────────────────────────────────────────────────
  async denunciar(usuarioId, inmuebleId, { motivo, descripcion }) {
    if (!MOTIVOS_DENUNCIA.includes(motivo)) throw new ErrorValidacion(`Motivo inválido. Opciones: ${MOTIVOS_DENUNCIA.join(", ")}`);
    const inmueble = await InmuebleRepository.buscarPorId(inmuebleId);
    if (!inmueble || inmueble.deletedAt) throw new ErrorNoEncontrado("Inmueble no encontrado");
    if (inmueble.publicadorId === usuarioId) throw new ErrorValidacion("No puedes denunciar tu propia publicación");
    const existente = await InmuebleRepository.buscarDenuncia(inmuebleId, usuarioId);
    if (existente) throw new ErrorValidacion("Ya denunciaste esta publicación");
    return InmuebleRepository.crearDenuncia({
      inmuebleId,
      denuncianteId: usuarioId,
      motivo,
      descripcion: descripcion?.trim() || null,
    });
  },

  async listarDenunciasPendientes() {
    return InmuebleRepository.listarDenunciasPendientes();
  },

  // Resuelve una denuncia: DESESTIMAR (queda constancia, no pasa nada más),
  // BLOQUEAR_PUBLICACION (cierra solo el inmueble denunciado), o
  // BLOQUEAR_CUENTA (cierra TODAS las publicaciones activas del publicador y
  // bloquea su cuenta) — mismo patrón secuencial que EmpleoService.resolverDenuncia:
  // no usa una única transacción Prisma gigante; si UsuarioService.bloquearCuenta
  // falla después de cerrar las publicaciones, el estado resultante es seguro.
  async resolverDenuncia(adminId, denunciaId, { accion, motivo }) {
    if (!["DESESTIMAR", "BLOQUEAR_PUBLICACION", "BLOQUEAR_CUENTA"].includes(accion)) {
      throw new ErrorValidacion("Acción inválida");
    }
    const denuncia = await InmuebleRepository.buscarDenunciaPorId(denunciaId);
    if (!denuncia) throw new ErrorNoEncontrado("Denuncia no encontrada");
    if (denuncia.estado !== "PENDIENTE") throw new ErrorValidacion("Esta denuncia ya fue resuelta");

    if (accion === "DESESTIMAR") {
      return InmuebleRepository.actualizarDenuncia(denunciaId, {
        estado: "DESESTIMADA",
        revisadoPor: adminId,
        revisadoAt: new Date(),
        notaRevision: motivo?.trim() || null,
      });
    }

    if (accion === "BLOQUEAR_PUBLICACION") {
      await InmuebleRepository.actualizar(denuncia.inmuebleId, {
        estado: "CERRADO",
        estadoModeracion: "RECHAZADA",
        revisadoPor: adminId,
        revisadoAt: new Date(),
        motivoRechazoModeracion: motivo?.trim() || `Denuncia: ${denuncia.motivo}`,
      });
      return InmuebleRepository.actualizarDenuncia(denunciaId, {
        estado: "PUBLICACION_BLOQUEADA",
        revisadoPor: adminId,
        revisadoAt: new Date(),
        notaRevision: motivo?.trim() || null,
      });
    }

    // BLOQUEAR_CUENTA — cierra todas las publicaciones del publicador y resuelve
    // de una vez TODAS sus denuncias pendientes (incluida esta misma) con el
    // estado CUENTA_BLOQUEADA, y llama a UsuarioService.bloquearCuenta (mismo
    // método que ya usa Empleo — no se reimplementa).
    const publicadorId = denuncia.inmueble.publicadorId;
    const motivoFinal = motivo?.trim() || `Cuenta bloqueada tras denuncia de inmueble #${denuncia.inmuebleId}`;
    await InmuebleRepository.cerrarTodosLosDelUsuario(publicadorId, adminId, motivoFinal);
    await InmuebleRepository.resolverDenunciasPendientesDelUsuario(publicadorId, "CUENTA_BLOQUEADA", adminId, motivoFinal);
    await UsuarioService.bloquearCuenta(adminId, publicadorId, motivoFinal);
    return InmuebleRepository.buscarDenunciaPorId(denunciaId);
  },
};

module.exports = InmuebleService;

// ============================================================
//  Servicio de Empleo / Bolsa de Trabajo comunitario (Fase 6)
//  Cualquier Usuario puede publicar y postularse (ver nota de diseño en
//  schema.prisma). Moderación ligera antes de publicar. La hoja de vida se
//  snapshotea en cada postulación.
// ============================================================
const crypto = require("crypto");
const EmpleoRepository = require("../repositories/empleo.repository");
const UsuarioRepository = require("../repositories/usuario.repository");
const UsuarioService = require("./usuario.service");
const ComercioRepository = require("../repositories/comercio.repository");
const Reglas = require("../config/reglas");
const { ErrorValidacion, ErrorNoEncontrado, ErrorProhibido } = require("../utils/errores");
const NotificacionService = require("./notificacion.service");

const TIPOS_CONTRATO = ["TIEMPO_COMPLETO", "MEDIO_TIEMPO", "POR_DIAS", "TEMPORAL", "OTRO"];
const TIPOS_PREGUNTA = ["TEXTO", "SI_NO", "OPCION_MULTIPLE"];
const MOTIVOS_DENUNCIA = ["OFERTA_FALSA", "EXPLOTACION_LABORAL", "DISCRIMINATORIA", "ESTAFA_DINERO", "CONTENIDO_INAPROPIADO", "OTRO"];
const TRANSICIONES_OFERTA = {
  BORRADOR: ["PUBLICADA"],
  PUBLICADA: ["PAUSADA", "CERRADA"],
  PAUSADA: ["PUBLICADA", "CERRADA"],
  CERRADA: [],
};

function normalizarPreguntas(preguntas) {
  if (!Array.isArray(preguntas)) return [];
  return preguntas.map((p, i) => {
    if (!p.texto?.trim()) throw new ErrorValidacion(`La pregunta #${i + 1} necesita un texto`);
    if (!TIPOS_PREGUNTA.includes(p.tipo)) {
      throw new ErrorValidacion(`Tipo de pregunta inválido en la pregunta #${i + 1}. Opciones: ${TIPOS_PREGUNTA.join(", ")}`);
    }
    const opciones = Array.isArray(p.opciones) ? p.opciones.map((o) => String(o).trim()).filter(Boolean) : [];
    if (p.tipo === "OPCION_MULTIPLE" && opciones.length < 2) {
      throw new ErrorValidacion(`La pregunta #${i + 1} de opción múltiple necesita al menos 2 opciones`);
    }
    return {
      id: p.id || crypto.randomUUID(),
      texto: p.texto.trim(),
      tipo: p.tipo,
      ...(p.tipo === "OPCION_MULTIPLE" ? { opciones } : {}),
    };
  });
}

// Exige y valida una respuesta por cada pregunta de la oferta; devuelve el
// snapshot [{preguntaId, texto, respuesta}] a guardar en la postulación.
function validarRespuestas(preguntas, respuestasEntrada) {
  if (!Array.isArray(preguntas) || preguntas.length === 0) return [];
  const porId = new Map();
  if (Array.isArray(respuestasEntrada)) {
    for (const r of respuestasEntrada) {
      if (r?.preguntaId) porId.set(r.preguntaId, r.respuesta);
    }
  }
  return preguntas.map((pregunta) => {
    const respuesta = porId.get(pregunta.id);
    if (respuesta == null || !String(respuesta).trim()) {
      throw new ErrorValidacion(`Debes responder: "${pregunta.texto}"`);
    }
    const valor = String(respuesta).trim();
    if (pregunta.tipo === "SI_NO" && !["Sí", "No"].includes(valor)) {
      throw new ErrorValidacion(`Respuesta inválida para "${pregunta.texto}"`);
    }
    if (pregunta.tipo === "OPCION_MULTIPLE" && !pregunta.opciones.includes(valor)) {
      throw new ErrorValidacion(`Respuesta inválida para "${pregunta.texto}"`);
    }
    return { preguntaId: pregunta.id, texto: pregunta.texto, respuesta: valor };
  });
}

function validarDatosOferta(datos) {
  if (!datos.titulo?.trim()) throw new ErrorValidacion("El título es obligatorio");
  if (!datos.descripcion?.trim()) throw new ErrorValidacion("La descripción es obligatoria");
  if (!datos.municipio?.trim()) throw new ErrorValidacion("El municipio es obligatorio");
  if (!TIPOS_CONTRATO.includes(datos.tipoContrato)) {
    throw new ErrorValidacion(`Tipo de contrato inválido. Opciones: ${TIPOS_CONTRATO.join(", ")}`);
  }
  if (datos.salarioMin != null && datos.salarioMax != null && Number(datos.salarioMin) > Number(datos.salarioMax)) {
    throw new ErrorValidacion("El salario mínimo no puede ser mayor al máximo");
  }
  if (datos.fechaCierre) {
    const fecha = new Date(datos.fechaCierre);
    if (Number.isNaN(fecha.getTime())) throw new ErrorValidacion("Fecha de cierre inválida");
    if (fecha <= new Date()) throw new ErrorValidacion("La fecha de cierre debe ser futura");
  }
}

const EmpleoService = {
  // ── Ofertas ──────────────────────────────────────────────────
  async crearOferta(usuarioId, datos) {
    validarDatosOferta(datos);

    // El publicador puede tener su propio comercio (comerciante) — si lo tiene, la
    // oferta queda vinculada automáticamente (antes no se vinculaba nunca, porque el
    // formulario no envía comercioId). Un comercio ya verificado (mismo KYC que el
    // resto de la plataforma) puede saltarse la moderación previa si la regla lo permite.
    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    const autoAprobar = !!comercio?.verificado && (await Reglas.bool("empleo_auto_aprobar_comercio_verificado"));

    return EmpleoRepository.crearOferta({
      publicadoPorId: usuarioId,
      comercioId: comercio ? comercio.id : null,
      titulo: datos.titulo.trim(),
      descripcion: datos.descripcion.trim(),
      categoria: datos.categoria?.trim() || null,
      tipoContrato: datos.tipoContrato,
      municipio: datos.municipio.trim(),
      departamento: datos.departamento?.trim() || null,
      salarioMin: datos.salarioMin != null ? Number(datos.salarioMin) : null,
      salarioMax: datos.salarioMax != null ? Number(datos.salarioMax) : null,
      salarioNegociable: !!datos.salarioNegociable,
      requisitos: datos.requisitos?.trim() || null,
      vacantes: datos.vacantes ? Number(datos.vacantes) : 1,
      contactoWhatsapp: datos.contactoWhatsapp?.trim() || null,
      fechaCierre: datos.fechaCierre ? new Date(datos.fechaCierre) : null,
      imagenUrl: datos.imagenUrl?.trim() || null,
      preguntas: normalizarPreguntas(datos.preguntas),
      ...(autoAprobar ? { estadoModeracion: "APROBADA" } : {}),
    });
  },

  async _obtenerPropia(usuarioId, ofertaId) {
    const oferta = await EmpleoRepository.buscarOfertaPorId(ofertaId);
    if (!oferta || oferta.deletedAt) throw new ErrorNoEncontrado("Oferta no encontrada");
    if (oferta.publicadoPorId !== usuarioId) throw new ErrorProhibido("No puedes modificar esta oferta");
    return oferta;
  },

  async actualizarOferta(usuarioId, ofertaId, datos) {
    const oferta = await this._obtenerPropia(usuarioId, ofertaId);
    if (oferta.estado !== "BORRADOR") {
      throw new ErrorValidacion("Solo puedes editar el contenido mientras la oferta está en borrador");
    }
    validarDatosOferta({ ...oferta, ...datos });
    const campos = {};
    for (const campo of ["titulo", "descripcion", "categoria", "tipoContrato", "municipio", "departamento", "requisitos", "contactoWhatsapp", "imagenUrl"]) {
      if (datos[campo] !== undefined) campos[campo] = typeof datos[campo] === "string" ? datos[campo].trim() : datos[campo];
    }
    if (datos.salarioMin !== undefined) campos.salarioMin = datos.salarioMin != null ? Number(datos.salarioMin) : null;
    if (datos.salarioMax !== undefined) campos.salarioMax = datos.salarioMax != null ? Number(datos.salarioMax) : null;
    if (datos.salarioNegociable !== undefined) campos.salarioNegociable = !!datos.salarioNegociable;
    if (datos.vacantes !== undefined) campos.vacantes = Number(datos.vacantes);
    if (datos.fechaCierre !== undefined) campos.fechaCierre = datos.fechaCierre ? new Date(datos.fechaCierre) : null;
    if (datos.preguntas !== undefined) campos.preguntas = normalizarPreguntas(datos.preguntas);
    return EmpleoRepository.actualizarOferta(ofertaId, campos);
  },

  async cambiarEstado(usuarioId, ofertaId, nuevoEstado) {
    const oferta = await this._obtenerPropia(usuarioId, ofertaId);
    const permitidos = TRANSICIONES_OFERTA[oferta.estado] || [];
    if (!permitidos.includes(nuevoEstado)) {
      throw new ErrorValidacion(`No puedes pasar de ${oferta.estado} a ${nuevoEstado}`);
    }
    if (nuevoEstado === "PUBLICADA" && oferta.estadoModeracion === "PENDIENTE" && oferta.estado === "BORRADOR") {
      // Primera publicación: queda esperando moderación, no visible aún.
      NotificacionService.ofertaEmpleoCreada({ oferta }).catch((e) => console.error("[EMPLEO] notificar creación:", e.message));
    }
    return EmpleoRepository.actualizarOferta(ofertaId, { estado: nuevoEstado });
  },

  async listarPublicas(filtros) {
    return EmpleoRepository.listarPublicas(filtros);
  },

  async obtenerDetallePublico(ofertaId) {
    const oferta = await EmpleoRepository.buscarOfertaPorId(ofertaId);
    if (!oferta || oferta.deletedAt) throw new ErrorNoEncontrado("Oferta no encontrada");
    return oferta;
  },

  async misOfertas(usuarioId) {
    return EmpleoRepository.listarPorPublicador(usuarioId);
  },

  async otrasDelPublicador(ofertaId) {
    const oferta = await EmpleoRepository.buscarOfertaPorId(ofertaId);
    if (!oferta || oferta.deletedAt) throw new ErrorNoEncontrado("Oferta no encontrada");
    return EmpleoRepository.listarOtrasDelPublicador(oferta.publicadoPorId, ofertaId);
  },

  // ── Favoritos ──────────────────────────────────────────────────
  async toggleFavorito(usuarioId, ofertaEmpleoId) {
    const existente = await EmpleoRepository.buscarFavorito(usuarioId, ofertaEmpleoId);
    if (existente) {
      await EmpleoRepository.eliminarFavorito(existente.id);
      return { favorito: false };
    }
    await EmpleoRepository.crearFavorito(usuarioId, ofertaEmpleoId);
    return { favorito: true };
  },

  async misFavoritos(usuarioId) {
    return EmpleoRepository.listarFavoritos(usuarioId);
  },

  async esFavorito(usuarioId, ofertaEmpleoId) {
    const existente = await EmpleoRepository.buscarFavorito(usuarioId, ofertaEmpleoId);
    return { favorito: !!existente };
  },

  // ── Moderación (admin) ───────────────────────────────────────
  async listarPendientesModeracion() {
    return EmpleoRepository.listarPendientesModeracion();
  },

  async moderar(adminId, ofertaId, { accion, motivo }) {
    if (!["APROBAR", "RECHAZAR"].includes(accion)) throw new ErrorValidacion("Acción inválida");
    const oferta = await EmpleoRepository.buscarOfertaPorId(ofertaId);
    if (!oferta) throw new ErrorNoEncontrado("Oferta no encontrada");
    const actualizada = await EmpleoRepository.actualizarOferta(ofertaId, {
      estadoModeracion: accion === "APROBAR" ? "APROBADA" : "RECHAZADA",
      revisadoPor: adminId,
      revisadoAt: new Date(),
      motivoRechazoModeracion: accion === "RECHAZAR" ? motivo?.trim() || null : null,
    });
    NotificacionService.ofertaEmpleoModerada({ oferta: actualizada }).catch((e) =>
      console.error("[EMPLEO] notificar moderación:", e.message)
    );
    return actualizada;
  },

  // ── Denuncias ─────────────────────────────────────────────────
  async denunciarOferta(usuarioId, ofertaId, { motivo, descripcion }) {
    if (!MOTIVOS_DENUNCIA.includes(motivo)) throw new ErrorValidacion(`Motivo inválido. Opciones: ${MOTIVOS_DENUNCIA.join(", ")}`);
    const oferta = await EmpleoRepository.buscarOfertaPorId(ofertaId);
    if (!oferta || oferta.deletedAt) throw new ErrorNoEncontrado("Oferta no encontrada");
    if (oferta.publicadoPorId === usuarioId) throw new ErrorValidacion("No puedes denunciar tu propia oferta");
    const existente = await EmpleoRepository.buscarDenuncia(ofertaId, usuarioId);
    if (existente) throw new ErrorValidacion("Ya denunciaste esta oferta");
    const denuncia = await EmpleoRepository.crearDenuncia({
      ofertaEmpleoId: ofertaId,
      denuncianteId: usuarioId,
      motivo,
      descripcion: descripcion?.trim() || null,
    });
    NotificacionService.denunciaOfertaEmpleoCreada({ denuncia, oferta }).catch((e) =>
      console.error("[EMPLEO] notificar denuncia:", e.message)
    );
    return denuncia;
  },

  async yaDenuncie(usuarioId, ofertaId) {
    const existente = await EmpleoRepository.buscarDenuncia(ofertaId, usuarioId);
    return { denunciado: !!existente };
  },

  async listarDenunciasPendientes() {
    return EmpleoRepository.listarDenunciasPendientes();
  },

  // Resuelve una denuncia: DESESTIMAR (queda constancia, no pasa nada más),
  // BLOQUEAR_OFERTA (cierra solo la oferta denunciada), o BLOQUEAR_CUENTA
  // (cierra TODAS las ofertas activas del publicador y bloquea su cuenta).
  //
  // Decisión de diseño aceptada: este flujo NO usa una única transacción
  // Prisma gigante cruzando servicios (evita over-engineering). Es secuencial;
  // si UsuarioService.bloquearCuenta falla después de cerrar las ofertas, el
  // estado resultante es seguro (ofertas cerradas, cuenta aún activa) y el
  // admin puede simplemente reintentar la acción.
  async resolverDenuncia(adminId, denunciaId, { accion, motivo }) {
    if (!["DESESTIMAR", "BLOQUEAR_OFERTA", "BLOQUEAR_CUENTA"].includes(accion)) {
      throw new ErrorValidacion("Acción inválida");
    }
    const denuncia = await EmpleoRepository.buscarDenunciaPorId(denunciaId);
    if (!denuncia) throw new ErrorNoEncontrado("Denuncia no encontrada");
    if (denuncia.estado !== "PENDIENTE") throw new ErrorValidacion("Esta denuncia ya fue resuelta");

    if (accion === "DESESTIMAR") {
      return EmpleoRepository.actualizarDenuncia(denunciaId, {
        estado: "DESESTIMADA",
        revisadoPor: adminId,
        revisadoAt: new Date(),
        notaRevision: motivo?.trim() || null,
      });
    }

    if (accion === "BLOQUEAR_OFERTA") {
      await EmpleoRepository.actualizarOferta(denuncia.ofertaEmpleoId, {
        estado: "CERRADA",
        estadoModeracion: "RECHAZADA",
        revisadoPor: adminId,
        revisadoAt: new Date(),
        motivoRechazoModeracion: motivo?.trim() || `Denuncia: ${denuncia.motivo}`,
      });
      const actualizada = await EmpleoRepository.actualizarDenuncia(denunciaId, {
        estado: "OFERTA_BLOQUEADA",
        revisadoPor: adminId,
        revisadoAt: new Date(),
        notaRevision: motivo?.trim() || null,
      });
      NotificacionService.ofertaEmpleoBloqueadaPorDenuncia({ oferta: denuncia.oferta, motivo }).catch((e) =>
        console.error("[EMPLEO] notificar bloqueo oferta:", e.message)
      );
      return actualizada;
    }

    // BLOQUEAR_CUENTA — cierra todas las ofertas del publicador y resuelve de
    // una vez TODAS sus denuncias pendientes (incluida esta misma, que sigue
    // en PENDIENTE en este punto) con el estado CUENTA_BLOQUEADA.
    const publicadoPorId = denuncia.oferta.publicadoPorId;
    const motivoFinal = motivo?.trim() || `Cuenta bloqueada tras denuncia de oferta de empleo #${denuncia.ofertaEmpleoId}`;
    await EmpleoRepository.cerrarTodasLasOfertasDelUsuario(publicadoPorId, adminId, motivoFinal);
    await EmpleoRepository.resolverDenunciasPendientesDelUsuario(publicadoPorId, "CUENTA_BLOQUEADA", adminId, motivoFinal);
    await UsuarioService.bloquearCuenta(adminId, publicadoPorId, motivoFinal);
    NotificacionService.cuentaBloqueadaPorDenuncia({ usuarioId: publicadoPorId, motivo: motivoFinal }).catch((e) =>
      console.error("[EMPLEO] notificar bloqueo cuenta:", e.message)
    );
    return EmpleoRepository.buscarDenunciaPorId(denunciaId);
  },

  // ── Hoja de vida ─────────────────────────────────────────────
  async obtenerMiHojaDeVida(usuarioId) {
    return EmpleoRepository.buscarHojaDeVida(usuarioId);
  },

  async guardarHojaDeVida(usuarioId, datos) {
    if (!datos.telefonoContacto?.trim()) throw new ErrorValidacion("El teléfono de contacto es obligatorio");
    return EmpleoRepository.upsertHojaDeVida(usuarioId, {
      resumenPerfil: datos.resumenPerfil?.trim() || null,
      telefonoContacto: datos.telefonoContacto.trim(),
      experiencia: Array.isArray(datos.experiencia) ? datos.experiencia : [],
      educacion: Array.isArray(datos.educacion) ? datos.educacion : [],
      habilidades: Array.isArray(datos.habilidades) ? datos.habilidades : [],
      disponibilidad: datos.disponibilidad?.trim() || null,
    });
  },

  async guardarCvHojaDeVida(usuarioId, cvUrl) {
    const hoja = await EmpleoRepository.buscarHojaDeVida(usuarioId);
    if (!hoja) throw new ErrorValidacion("Completa primero tu hoja de vida antes de adjuntar el CV");
    return EmpleoRepository.actualizarCv(usuarioId, cvUrl);
  },

  // ── Postulaciones ────────────────────────────────────────────
  async postularse(usuarioId, ofertaId, mensaje, respuestas) {
    const oferta = await EmpleoRepository.buscarOfertaPorId(ofertaId);
    if (!oferta || oferta.deletedAt) throw new ErrorNoEncontrado("Oferta no encontrada");
    if (oferta.estado !== "PUBLICADA" || oferta.estadoModeracion !== "APROBADA") {
      throw new ErrorValidacion("Esta oferta no está disponible para postulaciones");
    }
    if (oferta.fechaCierre && new Date(oferta.fechaCierre) < new Date()) {
      throw new ErrorValidacion("Esta oferta ya cerró el plazo de postulaciones");
    }
    if (oferta.publicadoPorId === usuarioId) {
      throw new ErrorValidacion("No puedes postularte a tu propia oferta");
    }

    const hoja = await EmpleoRepository.buscarHojaDeVida(usuarioId);
    if (!hoja) throw new ErrorValidacion("Debes completar tu hoja de vida antes de postularte");
    const postulante = await UsuarioRepository.buscarPorId(usuarioId);
    const respuestasSnap = validarRespuestas(oferta.preguntas, respuestas);

    const snapshot = {
      hojaDeVidaId: hoja.id,
      experienciaSnap: hoja.experiencia,
      educacionSnap: hoja.educacion,
      habilidadesSnap: hoja.habilidades,
      resumenPerfilSnap: hoja.resumenPerfil ?? null,
      disponibilidadSnap: hoja.disponibilidad ?? null,
      fotoSnapUrl: postulante?.avatarUrl ?? null,
      cvSnapUrl: hoja.cvUrl ?? null,
      respuestas: respuestasSnap,
      mensaje: mensaje?.trim() || null,
    };

    const existente = await EmpleoRepository.buscarPostulacion(ofertaId, usuarioId);
    let postulacion;
    if (existente) {
      // Si te habías retirado, te postulas de nuevo sobre el mismo registro
      // (el unique [ofertaEmpleoId, postulanteId] no permite crear otro).
      if (existente.estado !== "RETIRADA") throw new ErrorValidacion("Ya te postulaste a esta oferta");
      postulacion = await EmpleoRepository.actualizarPostulacion(existente.id, {
        ...snapshot,
        estado: "ENVIADA",
        vistaAt: null,
        notasPublicador: null,
      });
    } else {
      postulacion = await EmpleoRepository.crearPostulacion({
        ofertaEmpleoId: ofertaId,
        postulanteId: usuarioId,
        ...snapshot,
      });
    }

    NotificacionService.nuevaPostulacionEmpleo({ oferta, postulante: { id: usuarioId } }).catch((e) =>
      console.error("[EMPLEO] notificar nueva postulación:", e.message)
    );
    return postulacion;
  },

  async retirarPostulacion(usuarioId, postulacionId) {
    const postulacion = await EmpleoRepository.buscarPostulacionPorId(postulacionId);
    if (!postulacion) throw new ErrorNoEncontrado("Postulación no encontrada");
    if (postulacion.postulanteId !== usuarioId) {
      throw new ErrorProhibido("No puedes retirar esta postulación");
    }
    if (postulacion.estado === "CONTRATADO") {
      throw new ErrorValidacion("Ya fuiste contratado en esta postulación, no se puede retirar");
    }
    if (postulacion.estado === "RETIRADA") return postulacion;
    return EmpleoRepository.actualizarPostulacion(postulacionId, { estado: "RETIRADA" });
  },

  async misPostulaciones(usuarioId) {
    return EmpleoRepository.listarPostulacionesDeUsuario(usuarioId);
  },

  async postulacionesDeOferta(usuarioId, ofertaId) {
    await this._obtenerPropia(usuarioId, ofertaId);
    return EmpleoRepository.listarPostulacionesDeOferta(ofertaId);
  },

  async cambiarEstadoPostulacion(usuarioId, postulacionId, nuevoEstado, notasPublicador) {
    const ESTADOS_VALIDOS = ["VISTA", "PRESELECCIONADO", "RECHAZADA", "CONTRATADO"];
    if (!ESTADOS_VALIDOS.includes(nuevoEstado)) throw new ErrorValidacion("Estado inválido");

    const postulacion = await EmpleoRepository.buscarPostulacionPorId(postulacionId);
    if (!postulacion) throw new ErrorNoEncontrado("Postulación no encontrada");
    if (postulacion.oferta.publicadoPorId !== usuarioId) {
      throw new ErrorProhibido("No puedes gestionar esta postulación");
    }
    if (postulacion.estado === "RETIRADA") {
      throw new ErrorValidacion("El postulante retiró esta postulación");
    }

    const actualizada = await EmpleoRepository.actualizarPostulacion(postulacionId, {
      estado: nuevoEstado,
      ...(nuevoEstado === "VISTA" && !postulacion.vistaAt ? { vistaAt: new Date() } : {}),
      ...(notasPublicador !== undefined ? { notasPublicador: notasPublicador?.trim() || null } : {}),
    });

    if (nuevoEstado === "CONTRATADO" && postulacion.oferta.estado === "PUBLICADA") {
      const contratados = await EmpleoRepository.contarPostulacionesPorEstado(postulacion.ofertaEmpleoId, "CONTRATADO");
      if (contratados >= postulacion.oferta.vacantes) {
        const ofertaCerrada = await EmpleoRepository.actualizarOferta(postulacion.ofertaEmpleoId, { estado: "CERRADA" });
        NotificacionService.ofertaEmpleoVacantesLlenas({ oferta: ofertaCerrada }).catch((e) =>
          console.error("[EMPLEO] notificar vacantes llenas:", e.message)
        );
      }
    }

    NotificacionService.postulacionEmpleoActualizada({ postulacion: actualizada, postulanteId: postulacion.postulanteId }).catch((e) =>
      console.error("[EMPLEO] notificar cambio de postulación:", e.message)
    );
    return actualizada;
  },
};

module.exports = EmpleoService;

// ============================================================
//  Servicio de Usuario — lógica de negocio del perfil
// ============================================================
const prisma = require("../config/prisma");
const UsuarioRepository = require("../repositories/usuario.repository");
const { ErrorValidacion, ErrorNoEncontrado, ErrorNoAutorizado } = require("../utils/errores");
const NotificacionService = require("./notificacion.service");
const CulturaService = require("./cultura.service");
const bcrypt = require("bcryptjs");
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);

const UsuarioService = {
  async obtenerPerfil(id) {
    const usuario = await UsuarioRepository.buscarPorId(id);
    if (!usuario || !usuario.activo) throw new ErrorNoEncontrado("Usuario no encontrado");
    const { passwordHash, deletedAt, ...publico } = usuario;
    return publico;
  },

  async actualizarPerfil(id, datos) {
    const permitidos = ["nombre", "telefono", "tipoDocumento", "numeroDocumento", "municipio", "departamento", "bio"];
    const actualizacion = {};

    for (const campo of permitidos) {
      if (datos[campo] !== undefined) actualizacion[campo] = datos[campo];
    }

    if (actualizacion.nombre !== undefined) {
      actualizacion.nombre = String(actualizacion.nombre).trim();
      if (actualizacion.nombre.length < 2)
        throw new ErrorValidacion("El nombre debe tener al menos 2 caracteres");
      if (actualizacion.nombre.length > 100)
        throw new ErrorValidacion("El nombre no puede superar 100 caracteres");
    }

    if (actualizacion.bio !== undefined && actualizacion.bio !== null) {
      actualizacion.bio = String(actualizacion.bio).trim().slice(0, 280) || null;
    }

    if (actualizacion.telefono !== undefined && actualizacion.telefono !== null) {
      const tel = String(actualizacion.telefono).replace(/\D/g, "");
      if (tel.length !== 10) throw new ErrorValidacion("El teléfono debe tener 10 dígitos");
      // Verificar que no lo use otro usuario
      const existente = await UsuarioRepository.buscarPorTelefono(tel);
      if (existente && existente.id !== id)
        throw new ErrorValidacion("Ese número de teléfono ya está registrado");
      actualizacion.telefono = tel;
    }

    if (Object.keys(actualizacion).length === 0)
      throw new ErrorValidacion("No hay datos válidos para actualizar");

    const actualizado = await UsuarioRepository.actualizar(id, actualizacion);
    const { passwordHash, deletedAt, ...publico } = actualizado;
    return publico;
  },

  async cambiarPassword(id, { passwordActual, passwordNueva }) {
    if (!passwordActual || !passwordNueva)
      throw new ErrorValidacion("Se requieren la contraseña actual y la nueva.");
    if (passwordNueva.length < 6)
      throw new ErrorValidacion("La nueva contraseña debe tener al menos 6 caracteres.");

    const usuario = await UsuarioRepository.buscarPorId(id);
    if (!usuario || !usuario.activo) throw new ErrorNoEncontrado("Usuario no encontrado");

    const coincide = await bcrypt.compare(passwordActual, usuario.passwordHash);
    if (!coincide) throw new ErrorNoAutorizado("La contraseña actual no es correcta.");

    const nuevoHash = await bcrypt.hash(passwordNueva, BCRYPT_ROUNDS);
    await UsuarioRepository.actualizar(id, { passwordHash: nuevoHash });
  },

  // ── Bloqueo / activación de cuenta (lógica sensible, un solo lugar) ──────
  // Extraído literal de AdminController.toggleActivoUsuario para que otros
  // flujos (p. ej. resolución de denuncias del módulo Empleo) reutilicen
  // EXACTAMENTE el mismo comportamiento sin duplicar código de moderación.
  // El middleware `autenticar` ya rechaza a cualquier usuario con activo=false,
  // así que bloquear la cuenta basta para cortar todo el acceso.
  async bloquearCuenta(adminId, usuarioId, motivo) {
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, activo: true, rol: true } });
    if (!usuario) throw new ErrorNoEncontrado("Usuario no encontrado");
    if (usuario.rol === "ADMIN") throw new ErrorValidacion("No se puede desactivar a un administrador.");

    const dataUsuario = { activo: false, motivoBloqueo: motivo?.trim() || null, bloqueadoPor: adminId, bloqueadoAt: new Date() };

    const [actualizado] = await prisma.$transaction([
      prisma.usuario.update({ where: { id: usuarioId }, data: dataUsuario, select: { id: true, nombre: true, activo: true, motivoBloqueo: true } }),
      ...(usuario.rol === "COMERCIANTE"
        ? [prisma.comercio.updateMany({ where: { usuarioId }, data: { activo: false } })]
        : []),
      prisma.accionModeracion.create({
        data: {
          adminId,
          targetId: usuarioId,
          targetTipo: "USUARIO",
          accion: "BLOQUEAR",
          motivo: motivo?.trim() || null,
        },
      }),
    ]);

    return actualizado;
  },

  // Reactiva la cuenta de un usuario previamente bloqueado (inverso exacto de bloquearCuenta).
  async activarCuenta(adminId, usuarioId) {
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, activo: true, rol: true } });
    if (!usuario) throw new ErrorNoEncontrado("Usuario no encontrado");
    if (usuario.rol === "ADMIN") throw new ErrorValidacion("No se puede desactivar a un administrador.");

    const dataUsuario = { activo: true, motivoBloqueo: null, bloqueadoPor: null, bloqueadoAt: null };

    const [actualizado] = await prisma.$transaction([
      prisma.usuario.update({ where: { id: usuarioId }, data: dataUsuario, select: { id: true, nombre: true, activo: true, motivoBloqueo: true } }),
      ...(usuario.rol === "COMERCIANTE"
        ? [prisma.comercio.updateMany({ where: { usuarioId }, data: { activo: true } })]
        : []),
      prisma.accionModeracion.create({
        data: {
          adminId,
          targetId: usuarioId,
          targetTipo: "USUARIO",
          accion: "ACTIVAR",
          motivo: null,
        },
      }),
    ]);

    return actualizado;
  },

  // Usado por AdminController.toggleActivoUsuario — decide cuál de las dos
  // operaciones de arriba aplicar según el estado actual del usuario.
  async toggleActivo(adminId, usuarioId, motivo) {
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, activo: true, rol: true } });
    if (!usuario) throw new ErrorNoEncontrado("Usuario no encontrado");
    if (usuario.rol === "ADMIN") throw new ErrorValidacion("No se puede desactivar a un administrador.");

    if (usuario.activo) return this.bloquearCuenta(adminId, usuarioId, motivo);
    return this.activarCuenta(adminId, usuarioId);
  },

  // ── Seguir personas + perfil público (red social territorial) ──────
  // Mismo patrón que ComercioService.toggleSeguir/sigo, adaptado a la
  // self-relation Usuario↔Usuario (seguidorId/seguidoId).
  async toggleSeguir(seguidorId, seguidoId) {
    const sId = Number(seguidoId);
    if (sId === seguidorId) throw new ErrorValidacion("No puedes seguirte a ti mismo.");
    const existe = await prisma.seguidorUsuario.findUnique({
      where: { seguidorId_seguidoId: { seguidorId, seguidoId: sId } },
    });
    if (existe) {
      await prisma.seguidorUsuario.delete({ where: { id: existe.id } });
      return { siguiendo: false };
    }
    await prisma.seguidorUsuario.create({ data: { seguidorId, seguidoId: sId } });

    setImmediate(async () => {
      try {
        const seguidor = await prisma.usuario.findUnique({ where: { id: seguidorId }, select: { nombre: true } });
        await NotificacionService.crearYEnviar({
          usuarioId: sId,
          tipo: "USUARIO_NUEVO_SEGUIDOR",
          titulo: "Tienes un nuevo seguidor",
          mensaje: `${seguidor?.nombre || "Alguien"} empezó a seguirte`,
          url: `/persona/${seguidorId}`,
        });
      } catch (e) {
        console.error("[PERFIL] Error notificando nuevo seguidor:", e.message);
      }
    });

    return { siguiendo: true };
  },

  async sigo(seguidorId, seguidoId) {
    const existe = await prisma.seguidorUsuario.findUnique({
      where: { seguidorId_seguidoId: { seguidorId, seguidoId: Number(seguidoId) } },
    });
    return { siguiendo: !!existe };
  },

  async obtenerPerfilPublico(id, viewerId) {
    const usuario = await UsuarioRepository.buscarPerfilPublico(id);
    if (!usuario || !usuario.activo) throw new ErrorNoEncontrado("Usuario no encontrado");

    const [sigoResultado, publicaciones] = await Promise.all([
      viewerId ? this.sigo(viewerId, id) : Promise.resolve({ siguiendo: false }),
      CulturaService.listarPublicaciones({ autorId: id, page: 1, take: 12, usuarioId: viewerId }),
    ]);

    const { activo, _count, ...publico } = usuario;
    return {
      ...publico,
      totalSeguidores: _count?.seguidoresUsuarios ?? 0,
      totalSeguidos: _count?.siguiendoUsuarios ?? 0,
      sigo: sigoResultado.siguiendo,
      publicaciones: publicaciones.items,
      totalPublicaciones: publicaciones.total,
    };
  },
};

module.exports = UsuarioService;

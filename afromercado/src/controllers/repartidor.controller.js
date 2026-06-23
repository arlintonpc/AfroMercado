const path = require("path");
const fs = require("fs");
const multer = require("multer");
const prisma = require("../config/prisma");
const Reglas = require("../config/reglas");
const { subirACloudinary } = require("../utils/cloudinary");
const { ErrorNoEncontrado, ErrorProhibido, ErrorValidacion } = require("../utils/errores");
const NotificacionService = require("../services/notificacion.service");

const DIR_ENTREGAS = path.join(__dirname, "..", "..", "uploads", "entregas");
fs.mkdirSync(DIR_ENTREGAS, { recursive: true });

const _uploadFoto = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, DIR_ENTREGAS),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `entrega_${req.params.id}_${Date.now()}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
  limits: { fileSize: 6 * 1024 * 1024 },
}).single("foto");

const claveFoto = (id) => `entrega:${id}:foto`;

/** Pago al repartidor por una entrega, según el Centro de Reglas. */
function calcularPagoEntrega(entrega, modo, valor) {
  if (modo === "porcentaje_envio") {
    const envio = Number(entrega.subPedido?.pedido?.costoEnvio ?? 0);
    return Math.round(envio * (valor / 100));
  }
  return Math.round(valor); // fijo
}

/** Agrega pago calculado (y opcionalmente la foto de entrega) a una lista. */
async function decorarEntregas(entregas, { conFoto = false } = {}) {
  const [modo, valor] = await Promise.all([
    Reglas.obtener("repartidor_pago_modo"),
    Reglas.numero("repartidor_pago_valor"),
  ]);
  let fotos = {};
  if (conFoto && entregas.length) {
    const claves = entregas.map((e) => claveFoto(e.id));
    const rows = await prisma.config.findMany({ where: { clave: { in: claves } } });
    fotos = Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
  }
  return entregas.map((e) => ({
    ...e,
    pagoRepartidor: calcularPagoEntrega(e, modo, valor),
    ...(conFoto ? { fotoEntrega: fotos[claveFoto(e.id)] ?? null } : {}),
  }));
}

const INCLUDE_ENTREGA = {
  subPedido: {
    include: {
      pedido: {
        select: {
          id: true,
          direccionTexto: true,
          costoEnvio: true,
          comprador: { select: { id: true, nombre: true, telefono: true, email: true } },
        },
      },
      comercio: { select: { id: true, nombre: true, municipio: true, usuario: { select: { id: true } } } },
      items: {
        include: {
          producto: { select: { nombre: true } },
        },
      },
    },
  },
};

const TRANSICIONES = {
  ASIGNADA: ["RECOGIDA", "FALLIDA"],
  RECOGIDA: ["EN_CAMINO", "FALLIDA"],
  EN_CAMINO: ["ENTREGADA", "FALLIDA"],
};

const RepartidorController = {
  async misEntregas(req, res, next) {
    try {
      const { estado } = req.query;
      const estadoFiltro = estado
        ? { in: Array.isArray(estado) ? estado : [estado] }
        : undefined;

      const entregas = await prisma.entrega.findMany({
        where: {
          repartidorId: req.usuario.id,
          ...(estadoFiltro ? { estado: estadoFiltro } : {}),
        },
        include: INCLUDE_ENTREGA,
        orderBy: { createdAt: "desc" },
      });
      const data = await decorarEntregas(entregas, { conFoto: true });
      res.json({ ok: true, data });
    } catch (err) {
      next(err);
    }
  },

  async disponibles(req, res, next) {
    try {
      // Geo-filtro: por defecto el repartidor solo ve entregas cuyo comercio
      // está en su municipio base (de su solicitud aprobada). Con ?todos=1 ve
      // todas las zonas. Si no tiene municipio base, ve todas.
      const verTodos = req.query.todos === "1" || req.query.todos === "true";
      let municipioBase = null;
      if (!verTodos) {
        const sol = await prisma.solicitudRepartidor.findUnique({
          where: { usuarioId: req.usuario.id },
          select: { municipioBase: true, estado: true },
        });
        if (sol?.estado === "APROBADA" && sol.municipioBase?.trim()) {
          municipioBase = sol.municipioBase.trim();
        }
      }

      const entregas = await prisma.entrega.findMany({
        where: {
          repartidorId: null,
          ...(municipioBase
            ? { subPedido: { comercio: { municipio: { equals: municipioBase, mode: "insensitive" } } } }
            : {}),
        },
        include: INCLUDE_ENTREGA,
        orderBy: { createdAt: "desc" },
      });
      const data = await decorarEntregas(entregas);
      res.json({ ok: true, data, municipioBase });
    } catch (err) {
      next(err);
    }
  },

  async tomar(req, res, next) {
    try {
      const id = Number(req.params.id);
      const entrega = await prisma.entrega.findUnique({ where: { id } });
      if (!entrega) throw new ErrorNoEncontrado("Entrega no encontrada");
      if (entrega.repartidorId !== null)
        throw new ErrorProhibido("Esta entrega ya tiene repartidor asignado");

      const actualizada = await prisma.entrega.update({
        where: { id },
        data: { repartidorId: req.usuario.id },
        include: INCLUDE_ENTREGA,
      });
      res.json({ ok: true, data: actualizada });
    } catch (err) {
      next(err);
    }
  },

  async actualizarEstado(req, res, next) {
    try {
      const id = Number(req.params.id);
      const { estado, notas } = req.body || {};

      if (!estado) throw new ErrorValidacion("El campo estado es requerido");

      const entrega = await prisma.entrega.findUnique({ where: { id } });
      if (!entrega) throw new ErrorNoEncontrado("Entrega no encontrada");
      if (entrega.repartidorId !== req.usuario.id)
        throw new ErrorProhibido("No eres el repartidor asignado a esta entrega");

      const permitidos = TRANSICIONES[entrega.estado];
      if (!permitidos || !permitidos.includes(estado))
        throw new ErrorValidacion(
          `No puedes pasar de ${entrega.estado} a ${estado}`
        );

      const actualizada = await prisma.entrega.update({
        where: { id },
        data: { estado, notas: notas ?? entrega.notas },
        include: INCLUDE_ENTREGA,
      });

      if (estado === "ENTREGADA") {
        await prisma.subPedido.update({
          where: { id: entrega.subPedidoId },
          data: { estado: "ENTREGADO" },
        });

        const subPedido = await prisma.subPedido.findUnique({
          where: { id: entrega.subPedidoId },
          select: { pedidoId: true },
        });

        if (subPedido) {
          const todos = await prisma.subPedido.findMany({
            where: { pedidoId: subPedido.pedidoId },
            select: { estado: true },
          });
          const todosEntregados = todos.every((s) => s.estado === "ENTREGADO");
          if (todosEntregados) {
            await prisma.pedido.update({
              where: { id: subPedido.pedidoId },
              data: { estado: "ENTREGADO" },
            });
          }
        }
      }

      // Notificaciones en tiempo real según el nuevo estado
      const repartidorNombre = req.usuario.nombre;
      setImmediate(async () => {
        try {
          const sp = actualizada.subPedido;
          if (!sp) return;
          const pedidoId = sp.pedido?.id;
          const comprador = sp.pedido?.comprador;
          const comerciante = sp.comercio ? { ...sp.comercio, usuarioId: sp.comercio.usuario?.id } : null;
          if (!pedidoId || !comprador?.id) return;

          if (estado === "RECOGIDA") {
            await NotificacionService.entregaRecogida({ pedidoId, comprador, comerciante });
          } else if (estado === "EN_CAMINO") {
            await NotificacionService.entregaEnCamino({
              pedidoId, comprador,
              repartidorNombre,
              direccion: sp.pedido?.direccionTexto,
            });
          } else if (estado === "ENTREGADA") {
            await NotificacionService.pedidoEntregado({ pedidoId, comprador });
            await NotificacionService.entregaCompletadaComerciante({ pedidoId, comerciante });
          } else if (estado === "FALLIDA") {
            await NotificacionService.entregaFallida({ pedidoId, comprador });
          }
        } catch (e) {
          console.error("[NOTIF] actualizarEstado:", e.message);
        }
      });

      res.json({ ok: true, data: actualizada });
    } catch (err) {
      next(err);
    }
  },

  async listarAdmin(req, res, next) {
    try {
      const entregas = await prisma.entrega.findMany({
        include: INCLUDE_ENTREGA,
        orderBy: { createdAt: "desc" },
      });

      const repartidorIds = [...new Set(entregas.map((e) => e.repartidorId).filter(Boolean))];
      const repartidores =
        repartidorIds.length > 0
          ? await prisma.usuario.findMany({
              where: { id: { in: repartidorIds } },
              select: { id: true, nombre: true, telefono: true },
            })
          : [];

      const mapaRepartidores = Object.fromEntries(repartidores.map((r) => [r.id, r]));

      const resultado = entregas.map((e) => ({
        ...e,
        repartidor: e.repartidorId ? (mapaRepartidores[e.repartidorId] ?? null) : null,
      }));

      res.json({ ok: true, data: resultado });
    } catch (err) {
      next(err);
    }
  },

  async asignarAdmin(req, res, next) {
    try {
      const id = Number(req.params.id);
      const { repartidorId } = req.body || {};
      if (!repartidorId) throw new ErrorValidacion("El campo repartidorId es requerido");

      const entrega = await prisma.entrega.findUnique({ where: { id } });
      if (!entrega) throw new ErrorNoEncontrado("Entrega no encontrada");

      const repartidor = await prisma.usuario.findUnique({
        where: { id: Number(repartidorId) },
        select: { id: true, rol: true },
      });
      if (!repartidor || repartidor.rol !== "REPARTIDOR")
        throw new ErrorValidacion("El usuario no es un repartidor válido");

      const actualizada = await prisma.entrega.update({
        where: { id },
        data: { repartidorId: repartidor.id },
        include: INCLUDE_ENTREGA,
      });

      // N-R-04: notificar al repartidor
      setImmediate(async () => {
        try {
          const repartidorCompleto = await prisma.usuario.findUnique({
            where: { id: repartidor.id },
            select: { id: true, nombre: true, telefono: true },
          });
          if (!repartidorCompleto) return;
          const sp = actualizada.subPedido;
          await NotificacionService.entregaAsignada({
            entregaId: id,
            pedidoId: sp?.pedido?.id,
            repartidor: repartidorCompleto,
            comercioNombre: sp?.comercio?.nombre,
            comercioMunicipio: sp?.comercio?.municipio,
            direccion: sp?.pedido?.direccionTexto,
          });
        } catch (e) {
          console.error("[NOTIF] asignarAdmin:", e.message);
        }
      });

      res.json({ ok: true, data: actualizada });
    } catch (err) {
      next(err);
    }
  },

  // POST /repartidor/solicitar
  async enviarSolicitud(req, res, next) {
    try {
      const usuarioId = req.usuario.id;
      const {
        vehiculoTipo, vehiculoMarca, vehiculoModelo, vehiculoColor,
        vehiculoPlaca, vehiculoAnio, licenciaNumero,
        fotoVehiculoUrl, fotoLicenciaUrl, municipioBase,
      } = req.body;

      const TIPOS_VALIDOS = ["MOTO", "BICICLETA", "CARRO", "CAMIONETA", "TRICIMOTO"];
      if (!TIPOS_VALIDOS.includes(vehiculoTipo))
        throw new ErrorValidacion("Tipo de vehículo inválido");
      if (!vehiculoMarca?.trim())  throw new ErrorValidacion("La marca del vehículo es requerida");
      if (!vehiculoModelo?.trim()) throw new ErrorValidacion("El modelo del vehículo es requerido");
      if (!vehiculoColor?.trim())  throw new ErrorValidacion("El color del vehículo es requerido");
      if (!vehiculoPlaca?.trim())  throw new ErrorValidacion("La placa del vehículo es requerida");
      const anio = parseInt(vehiculoAnio);
      if (!anio || anio < 1990 || anio > new Date().getFullYear() + 1)
        throw new ErrorValidacion("Año del vehículo inválido");
      if (!licenciaNumero?.trim()) throw new ErrorValidacion("El número de licencia es requerido");

      const existente = await prisma.solicitudRepartidor.findUnique({ where: { usuarioId } });
      if (existente) {
        if (existente.estado === "APROBADA")
          throw new ErrorValidacion("Tu solicitud ya fue aprobada");
        if (existente.estado === "PENDIENTE")
          throw new ErrorValidacion("Ya tienes una solicitud pendiente de revisión");
        // Si fue RECHAZADA, se permite reenviar: actualizamos
        const actualizada = await prisma.solicitudRepartidor.update({
          where: { usuarioId },
          data: {
            vehiculoTipo, vehiculoMarca: vehiculoMarca.trim(),
            vehiculoModelo: vehiculoModelo.trim(), vehiculoColor: vehiculoColor.trim(),
            vehiculoPlaca: vehiculoPlaca.trim().toUpperCase(),
            vehiculoAnio: anio, licenciaNumero: licenciaNumero.trim(),
            fotoVehiculoUrl: fotoVehiculoUrl ?? null,
            fotoLicenciaUrl: fotoLicenciaUrl ?? null,
            municipioBase: municipioBase?.trim() ?? "",
            estado: "PENDIENTE", notasAdmin: null, revisadoPor: null, revisadoAt: null,
          },
        });
        setImmediate(async () => {
          try {
            await NotificacionService.solicitudRepartidorCreada({
              usuarioId,
              usuarioNombre: req.usuario.nombre,
            });
          } catch (e) {
            console.error("[NOTIF] solicitud repartidor reenviada:", e.message);
          }
        });
        return res.json({ ok: true, data: actualizada });
      }

      const solicitud = await prisma.solicitudRepartidor.create({
        data: {
          usuarioId, vehiculoTipo,
          vehiculoMarca: vehiculoMarca.trim(), vehiculoModelo: vehiculoModelo.trim(),
          vehiculoColor: vehiculoColor.trim(),
          vehiculoPlaca: vehiculoPlaca.trim().toUpperCase(),
          vehiculoAnio: anio, licenciaNumero: licenciaNumero.trim(),
          fotoVehiculoUrl: fotoVehiculoUrl ?? null,
          fotoLicenciaUrl: fotoLicenciaUrl ?? null,
          municipioBase: municipioBase?.trim() ?? "",
        },
      });

      // N-R-01 + N-A-04: confirmar al solicitante y alertar admins
      setImmediate(async () => {
        try {
          await NotificacionService.solicitudRepartidorCreada({
            usuarioId,
            usuarioNombre: req.usuario.nombre,
          });
        } catch (e) {
          console.error("[NOTIF] solicitud repartidor creada:", e.message);
        }
      });

      res.status(201).json({ ok: true, data: solicitud });
    } catch (err) { next(err); }
  },

  // GET /repartidor/mi-solicitud
  async miSolicitud(req, res, next) {
    try {
      const solicitud = await prisma.solicitudRepartidor.findUnique({
        where: { usuarioId: req.usuario.id },
      });
      res.json({ ok: true, data: solicitud ?? null });
    } catch (err) { next(err); }
  },

  // Middleware multer (campo "foto") para la subida de prueba de entrega.
  uploadFotoEntrega: _uploadFoto,

  // POST /repartidor/entregas/:id/foto — prueba de entrega (foto)
  async subirFotoEntrega(req, res, next) {
    try {
      const id = Number(req.params.id);
      if (!req.file) throw new ErrorValidacion("Adjunta la foto (campo 'foto')");

      const entrega = await prisma.entrega.findUnique({
        where: { id },
        select: { id: true, repartidorId: true },
      });
      if (!entrega) throw new ErrorNoEncontrado("Entrega no encontrada");
      if (entrega.repartidorId !== req.usuario.id)
        throw new ErrorProhibido("No eres el repartidor asignado a esta entrega");

      const cloud = await subirACloudinary(req.file.path, "afromercado/entregas");
      const url = cloud
        ? (() => { try { fs.unlinkSync(req.file.path); } catch { /* noop */ } return cloud; })()
        : `${req.protocol}://${req.get("host")}/uploads/entregas/${req.file.filename}`;

      await prisma.config.upsert({
        where: { clave: claveFoto(id) },
        create: { clave: claveFoto(id), valor: url },
        update: { valor: url },
      });

      res.json({ ok: true, url });
    } catch (err) { next(err); }
  },
};

module.exports = RepartidorController;

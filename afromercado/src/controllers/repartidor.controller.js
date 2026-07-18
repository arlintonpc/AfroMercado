const path = require("path");
const fs = require("fs");
const multer = require("multer");
const prisma = require("../config/prisma");
const { subirACloudinary } = require("../utils/cloudinary");
const { ErrorNoEncontrado, ErrorProhibido, ErrorValidacion } = require("../utils/errores");
const NotificacionService = require("../services/notificacion.service");
const sseManager = require("../utils/sse-manager");
const {
  obtenerConfiguracionPago,
  calcularPagoEntrega,
} = require("../services/pago-repartidor.service");

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

// Documentos de la solicitud de repartidor (cédula, matrícula, etc.) se guardan
// como JSON en Config por usuario, evitando una migración de esquema.
const claveDocs = (usuarioId) => `repartidor_docs:${usuarioId}`;

const DIR_REP = path.join(__dirname, "..", "..", "uploads", "repartidores");
fs.mkdirSync(DIR_REP, { recursive: true });

const _uploadDoc = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, DIR_REP),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `rep_${req.usuario.id}_${Date.now()}_${Math.round(Math.random() * 1e4)}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
  limits: { fileSize: 6 * 1024 * 1024 },
}).single("foto");

/** Pago al repartidor por una entrega, según el Centro de Reglas. */
/** Agrega pago calculado (y opcionalmente la foto de entrega) a una lista. */
async function decorarEntregas(entregas, { conFoto = false } = {}) {
  const { modo, valor } = await obtenerConfiguracionPago();
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

// Anexo B, Fase 5: una Entrega ahora viene de SubPedido (Marketplace) o de
// PedidoExpress (Express en modo PLATAFORMA) — mutuamente excluyentes. Estos
// helpers normalizan el acceso para no repetir `?? ` en cada función.
function compradorIdDe(entrega) {
  return entrega.subPedido?.pedido?.compradorId ?? entrega.pedidoExpress?.clienteId ?? null;
}
function pedidoIdDe(entrega) {
  return entrega.subPedido?.pedido?.id ?? entrega.pedidoExpress?.id ?? null;
}
function compradorDe(entrega) {
  return entrega.subPedido?.pedido?.comprador ?? entrega.pedidoExpress?.cliente ?? null;
}
function comercioDe(entrega) {
  const c = entrega.subPedido?.comercio ?? entrega.pedidoExpress?.configExpress?.comercio ?? null;
  if (!c) return null;
  return { id: c.id, nombre: c.nombre, municipio: c.municipio, usuarioId: c.usuario?.id ?? null };
}
function direccionDe(entrega) {
  return entrega.subPedido?.pedido?.direccionTexto ?? entrega.pedidoExpress?.direccionTexto ?? null;
}
function urlPedidoDe(entrega) {
  return entrega.pedidoExpressId ? "/express/mis-pedidos" : "/mis-pedidos";
}

const INCLUDE_ENTREGA = {
  subPedido: {
    include: {
      pedido: {
        select: {
          id: true,
          compradorId: true,
          direccionTexto: true,
          costoEnvio: true,
          _count: { select: { subPedidos: true } },
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
  pedidoExpress: {
    include: {
      cliente: { select: { id: true, nombre: true, telefono: true, email: true } },
      configExpress: { select: { comercio: { select: { id: true, nombre: true, municipio: true, usuario: { select: { id: true } } } } } },
      items: { include: { producto: { select: { nombre: true } } } },
    },
  },
  repartidor: { select: { id: true, nombre: true, telefono: true } },
};

const TRANSICIONES = {
  ASIGNADA: ["RECOGIDA", "FALLIDA"],
  RECOGIDA: ["EN_CAMINO", "FALLIDA"],
  EN_CAMINO: ["ENTREGADA", "FALLIDA"],
};

async function asignarRepartidorAtomica(tx, {
  entregaId,
  repartidorId,
  compradorIdBloqueado = null,
  permitirReasignacion = false,
  mensajeOcupada = "Esta entrega ya tiene repartidor asignado",
  mensajeBloqueada = "No puedes asignar esta entrega",
}) {
  const entrega = await tx.entrega.findUnique({
    where: { id: entregaId },
    select: {
      id: true,
      estado: true,
      repartidorId: true,
      subPedido: { select: { pedido: { select: { compradorId: true } } } },
      pedidoExpress: { select: { clienteId: true } },
    },
  });

  if (!entrega) {
    throw new ErrorNoEncontrado("Entrega no encontrada");
  }

  if (["ENTREGADA", "FALLIDA"].includes(entrega.estado)) {
    throw new ErrorValidacion("No se puede asignar o reasignar una entrega finalizada");
  }
  if (!permitirReasignacion && entrega.estado !== "ASIGNADA") {
    throw new ErrorProhibido("Solo se pueden tomar entregas en estado ASIGNADA");
  }

  const compradorId = entrega.subPedido?.pedido?.compradorId ?? entrega.pedidoExpress?.clienteId ?? null;
  if (compradorIdBloqueado !== null && compradorId === compradorIdBloqueado) {
    throw new ErrorProhibido(mensajeBloqueada);
  }

  if (!permitirReasignacion && entrega.repartidorId !== null) {
    throw new ErrorProhibido(mensajeOcupada);
  }

  const actualizacion = await tx.entrega.updateMany({
    where: {
      id: entregaId,
      repartidorId: entrega.repartidorId,
      estado: entrega.estado,
    },
    data: { repartidorId },
  });

  if (actualizacion.count === 0) {
    throw new ErrorProhibido(mensajeOcupada);
  }

  return tx.entrega.findUnique({
    where: { id: entregaId },
    include: INCLUDE_ENTREGA,
  });
}

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

      // Candado: el repartidor no ve (ni puede tomar) entregas de su propio pedido.
      // OR entre los dos orígenes posibles — un filtro `subPedido: {...}` simple
      // no matchea nunca una Entrega de origen Express (subPedido es null ahí).
      const entregas = await prisma.entrega.findMany({
        where: {
          repartidorId: null,
          estado: "ASIGNADA",
          OR: [
            {
              subPedido: {
                pedido: { compradorId: { not: req.usuario.id } },
                ...(municipioBase
                  ? { comercio: { municipio: { equals: municipioBase, mode: "insensitive" } } }
                  : {}),
              },
            },
            {
              pedidoExpress: {
                clienteId: { not: req.usuario.id },
                ...(municipioBase
                  ? { configExpress: { comercio: { municipio: { equals: municipioBase, mode: "insensitive" } } } }
                  : {}),
              },
            },
          ],
        },
        include: INCLUDE_ENTREGA,
        // Urgencia real (Fase 5): un domicilio Express es comida que se enfría
        // mientras espera — se muestra antes que un paquete de Marketplace,
        // y dentro de cada origen, lo que lleva más tiempo esperando primero.
        orderBy: { createdAt: "asc" },
      });
      entregas.sort((a, b) => {
        const urgenteA = a.pedidoExpressId ? 0 : 1;
        const urgenteB = b.pedidoExpressId ? 0 : 1;
        if (urgenteA !== urgenteB) return urgenteA - urgenteB;
        return new Date(a.createdAt) - new Date(b.createdAt);
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
      const actualizada = await prisma.$transaction((tx) =>
        asignarRepartidorAtomica(tx, {
          entregaId: id,
          repartidorId: req.usuario.id,
          compradorIdBloqueado: req.usuario.id,
          mensajeBloqueada: "No puedes tomar la entrega de tu propio pedido",
        })
      );
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

      const configuracionPago = estado === "ENTREGADA"
        ? await obtenerConfiguracionPago()
        : null;

      const actualizada = await prisma.$transaction(async (tx) => {
        const entrega = await tx.entrega.findUnique({
          where: { id },
          include: INCLUDE_ENTREGA,
        });
        if (!entrega) throw new ErrorNoEncontrado("Entrega no encontrada");
        if (entrega.repartidorId !== req.usuario.id) {
          throw new ErrorProhibido("No eres el repartidor asignado a esta entrega");
        }

        const permitidos = TRANSICIONES[entrega.estado];
        if (!permitidos || !permitidos.includes(estado)) {
          throw new ErrorValidacion(`No puedes pasar de ${entrega.estado} a ${estado}`);
        }

        const pagoRepartidor = estado === "ENTREGADA"
          ? calcularPagoEntrega(entrega, configuracionPago.modo, configuracionPago.valor)
          : entrega.pagoRepartidor;
        const cambio = await tx.entrega.updateMany({
          where: {
            id,
            repartidorId: req.usuario.id,
            estado: entrega.estado,
          },
          data: {
            estado,
            notas: notas ?? entrega.notas,
            ...(estado === "ENTREGADA" ? { pagoRepartidor } : {}),
          },
        });
        if (cambio.count === 0) {
          throw new ErrorProhibido("La entrega cambió de asignación o estado; recarga e intenta de nuevo");
        }

        if (estado === "ENTREGADA") {
          if (entrega.subPedidoId) {
            await tx.subPedido.update({
              where: { id: entrega.subPedidoId },
              data: { estado: "ENTREGADO" },
            });

            const todos = await tx.subPedido.findMany({
              where: { pedidoId: entrega.subPedido.pedido.id },
              select: { estado: true },
            });
            if (todos.every((subPedido) => subPedido.estado === "ENTREGADO")) {
              await tx.pedido.update({
                where: { id: entrega.subPedido.pedido.id },
                data: { estado: "ENTREGADO" },
              });
            }
          } else if (entrega.pedidoExpressId) {
            // Un PedidoExpress es siempre de un solo comercio — no hay
            // "esperar a los demás subpedidos" como en Marketplace.
            await tx.pedidoExpress.update({
              where: { id: entrega.pedidoExpressId },
              data: { estado: "ENTREGADO", entregadoAt: new Date() },
            });
          }
        }

        return tx.entrega.findUnique({
          where: { id },
          include: INCLUDE_ENTREGA,
        });
      });

      if (estado === "ENTREGADA" && actualizada?.subPedido?.pedido?.id) {
        await prisma.pedido.updateMany({
          where: {
            id: actualizada.subPedido.pedido.id,
            subPedidos: { every: { estado: "ENTREGADO" } },
          },
          data: { estado: "ENTREGADO" },
        });
      }

      // Notificaciones en tiempo real según el nuevo estado
      const repartidorNombre = req.usuario.nombre;
      setImmediate(async () => {
        try {
          const pedidoId = pedidoIdDe(actualizada);
          const comprador = compradorDe(actualizada);
          const comerciante = comercioDe(actualizada);
          const url = urlPedidoDe(actualizada);
          if (!pedidoId || !comprador?.id) return;

          if (estado === "RECOGIDA") {
            await NotificacionService.entregaRecogida({ pedidoId, comprador, comerciante, url });
          } else if (estado === "EN_CAMINO") {
            await NotificacionService.entregaEnCamino({
              pedidoId, comprador,
              repartidorNombre,
              direccion: direccionDe(actualizada),
              url,
            });
          } else if (estado === "ENTREGADA") {
            await NotificacionService.pedidoEntregado({ pedidoId, comprador, url });
            await NotificacionService.entregaCompletadaComerciante({ pedidoId, comerciante });
          } else if (estado === "FALLIDA") {
            await NotificacionService.entregaFallida({ pedidoId, comprador, url });
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

  // PATCH /repartidor/entregas/:id/ubicacion (Fase 4.1) — el repartidor emite su
  // posición cada 10-15s mientras la entrega está EN_CAMINO; se reenvía por el
  // mismo stream SSE de notificaciones que el comprador ya tiene abierto.
  async actualizarUbicacion(req, res, next) {
    try {
      const id = Number(req.params.id);
      const { lat, lng } = req.body || {};
      const latitud = Number(lat);
      const longitud = Number(lng);
      if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) {
        throw new ErrorValidacion("lat/lng inválidos");
      }

      const entrega = await prisma.entrega.findUnique({
        where: { id },
        include: {
          subPedido: { include: { pedido: { select: { compradorId: true } } } },
          pedidoExpress: { select: { clienteId: true } },
        },
      });
      if (!entrega) throw new ErrorNoEncontrado("Entrega no encontrada");
      if (entrega.repartidorId !== req.usuario.id) {
        throw new ErrorProhibido("No eres el repartidor asignado a esta entrega");
      }
      if (entrega.estado !== "EN_CAMINO") {
        throw new ErrorValidacion("Solo se puede reportar ubicación mientras la entrega está EN_CAMINO");
      }

      const ahora = new Date();
      await prisma.entrega.update({
        where: { id },
        data: { ultimaLatitud: latitud, ultimaLongitud: longitud, ultimaUbicacionAt: ahora },
      });

      const compradorId = compradorIdDe(entrega);
      if (compradorId) {
        sseManager.enviar(compradorId, "ubicacion-repartidor", {
          entregaId: id,
          lat: latitud,
          lng: longitud,
          actualizadoAt: ahora,
        });
      }

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },

  // POST /repartidor/entregas/:id/calificar (Fase 4.2) — solo el comprador
  // dueño del pedido, solo tras ENTREGADA, unique constraint evita doble calificación.
  async calificar(req, res, next) {
    try {
      const id = Number(req.params.id);
      const { calificacion, comentario } = req.body || {};
      const nota = Number(calificacion);
      if (!Number.isInteger(nota) || nota < 1 || nota > 5) {
        throw new ErrorValidacion("La calificación debe ser un entero entre 1 y 5");
      }

      const entrega = await prisma.entrega.findUnique({
        where: { id },
        include: {
          subPedido: { include: { pedido: { select: { compradorId: true } } } },
          pedidoExpress: { select: { clienteId: true } },
        },
      });
      if (!entrega) throw new ErrorNoEncontrado("Entrega no encontrada");
      if (!entrega.repartidorId) throw new ErrorValidacion("Esta entrega no tiene repartidor asignado");
      if (compradorIdDe(entrega) !== req.usuario.id) {
        throw new ErrorProhibido("No puedes calificar esta entrega");
      }
      if (entrega.estado !== "ENTREGADA") {
        throw new ErrorValidacion("Solo puedes calificar una entrega ya finalizada");
      }

      const existente = await prisma.calificacionRepartidor.findUnique({ where: { entregaId: id } });
      if (existente) throw new ErrorValidacion("Ya calificaste esta entrega");

      const nueva = await prisma.calificacionRepartidor.create({
        data: {
          entregaId: id,
          repartidorId: entrega.repartidorId,
          compradorId: req.usuario.id,
          calificacion: nota,
          comentario: comentario?.trim() || null,
        },
      });
      res.status(201).json({ ok: true, data: nueva });
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

      const entrega = await prisma.entrega.findUnique({
        where: { id },
        include: {
          subPedido: { select: { pedido: { select: { compradorId: true } } } },
          pedidoExpress: { select: { clienteId: true } },
        },
      });
      if (!entrega) throw new ErrorNoEncontrado("Entrega no encontrada");

      const repartidor = await prisma.usuario.findUnique({
        where: { id: Number(repartidorId) },
        select: { id: true, rol: true, activo: true },
      });
      if (!repartidor || repartidor.rol !== "REPARTIDOR" || !repartidor.activo)
        throw new ErrorValidacion("El usuario no es un repartidor válido");
      if (compradorIdDe(entrega) === repartidor.id)
        throw new ErrorValidacion("No puedes asignar a un repartidor su propio pedido");

      const actualizada = await prisma.$transaction((tx) =>
        asignarRepartidorAtomica(tx, {
          entregaId: id,
          repartidorId: repartidor.id,
          compradorIdBloqueado: repartidor.id,
          permitirReasignacion: true,
          mensajeBloqueada: "No puedes asignar a un repartidor su propio pedido",
        })
      );

      // N-R-04: notificar al repartidor
      setImmediate(async () => {
        try {
          const repartidorCompleto = await prisma.usuario.findUnique({
            where: { id: repartidor.id },
            select: { id: true, nombre: true, telefono: true },
          });
          if (!repartidorCompleto) return;
          const comercio = comercioDe(actualizada);
          await NotificacionService.entregaAsignada({
            entregaId: id,
            pedidoId: pedidoIdDe(actualizada),
            repartidor: repartidorCompleto,
            comercioNombre: comercio?.nombre,
            comercioMunicipio: comercio?.municipio,
            direccion: direccionDe(actualizada),
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
        fotoVehiculoUrl, fotoLicenciaUrl, municipioBase, documentos,
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

      // Documentos (cédula, matrícula, licencia, SOAT, etc.) → Config por usuario.
      if (documentos && typeof documentos === "object") {
        await prisma.config.upsert({
          where: { clave: claveDocs(usuarioId) },
          create: { clave: claveDocs(usuarioId), valor: JSON.stringify(documentos) },
          update: { valor: JSON.stringify(documentos) },
        });
      }

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
      let documentos = null;
      const docsRow = await prisma.config.findUnique({ where: { clave: claveDocs(req.usuario.id) } });
      if (docsRow?.valor) { try { documentos = JSON.parse(docsRow.valor); } catch { /* noop */ } }
      res.json({ ok: true, data: solicitud ? { ...solicitud, documentos } : null });
    } catch (err) { next(err); }
  },

  // Middleware multer (campo "foto") para subir un documento de la solicitud.
  uploadDocSolicitud: _uploadDoc,

  // POST /repartidor/solicitud/foto — sube un documento (cédula, matrícula, etc.)
  async subirDocSolicitud(req, res, next) {
    try {
      if (!req.file) throw new ErrorValidacion("Adjunta la imagen (campo 'foto')");
      const cloud = await subirACloudinary(req.file.path, "afromercado/repartidores");
      const url = cloud
        ? (() => { try { fs.unlinkSync(req.file.path); } catch { /* noop */ } return cloud; })()
        : `${req.protocol}://${req.get("host")}/uploads/repartidores/${req.file.filename}`;
      res.json({ ok: true, url });
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

// ============================================================
//  Controlador de Comercios
//  Recibe la petición HTTP, llama al servicio y responde.
//  No tiene lógica de negocio.
// ============================================================
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const ComercioService = require("../services/comercio.service");
const NotificacionService = require("../services/notificacion.service");
const prisma = require("../config/prisma");
const { ErrorValidacion } = require("../utils/errores");
const { subirVideoACloudinary, eliminarDeCloudinary } = require("../utils/cloudinary");
const {
  crearUploadVideo,
  extraerVideoMeta,
  urlLocalVideo,
} = require("../utils/video-media");

const DIR_DOCS = path.join(__dirname, "..", "..", "uploads", "documentos");
fs.mkdirSync(DIR_DOCS, { recursive: true });
const DIR_VIDEOS_COMERCIOS = path.join(
  __dirname,
  "..",
  "..",
  "uploads",
  "videos",
  "comercios",
);
fs.mkdirSync(DIR_VIDEOS_COMERCIOS, { recursive: true });

const _uploadDoc = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, DIR_DOCS),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `doc_${req.usuario.id}_${Date.now()}${ext}`);
    },
  }),
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("documento");

const _uploadVideo = crearUploadVideo({
  dir: DIR_VIDEOS_COMERCIOS,
  prefijo: "comercio-video",
  fieldName: "video",
  maxFileSize: 100 * 1024 * 1024,
});

const ComercioController = {
  async registrar(req, res, next) {
    try {
      const comercio = await ComercioService.registrar(req.usuario.id, req.body);
      res.status(201).json({ ok: true, comercio });
    } catch (e) {
      next(e);
    }
  },

  async miComercio(req, res, next) {
    try {
      const comercio = await ComercioService.obtenerMiComercio(req.usuario.id);
      res.json({ ok: true, comercio });
    } catch (e) {
      next(e);
    }
  },

  async obtener(req, res, next) {
    try {
      const comercio = await ComercioService.obtenerPorId(req.params.id);
      res.json({ ok: true, comercio });
    } catch (e) {
      next(e);
    }
  },

  async actualizar(req, res, next) {
    try {
      const comercio = await ComercioService.actualizar(req.usuario.id, req.body);
      res.json({ ok: true, comercio });
    } catch (e) {
      next(e);
    }
  },

  // GET /comercios/mis-analiticas — analíticas completas del comerciante
  uploadVideo: _uploadVideo,

  async subirVideo(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, error: "No se recibio video." });
      }

      const meta = extraerVideoMeta(req.body);
      const duracion = meta.durationSeconds;
      if (duracion !== null && duracion > 45) {
        fs.unlink(req.file.path, () => {});
        throw new ErrorValidacion("El video no puede superar 45 segundos");
      }

      await ComercioService.obtenerMiComercio(req.usuario.id);
      const cloud = await subirVideoACloudinary(req.file.path, "afromercado/videos/comercios");
      const duracionFinal = cloud?.duration ?? duracion;
      if (duracionFinal !== null && duracionFinal > 45) {
        if (cloud?.publicId) {
          await eliminarDeCloudinary(cloud.publicId, "video").catch(() => {});
        }
        fs.unlink(req.file.path, () => {});
        throw new ErrorValidacion("El video no puede superar 45 segundos");
      }

      const datosVideo = cloud
        ? {
            videoUrl: cloud.optimizedUrl || cloud.secureUrl,
            videoPosterUrl: cloud.posterUrl ?? null,
            videoPublicId: cloud.publicId ?? null,
            videoDuracionSegundos: duracionFinal,
            videoAncho: cloud.width ?? meta.width,
            videoAlto: cloud.height ?? meta.height,
            videoBytes: cloud.bytes ?? meta.bytes,
            videoFormato: cloud.format ?? meta.format,
            videoMimeType: cloud.mimeType ?? meta.mimeType,
          }
        : {
            videoUrl: urlLocalVideo(req, `uploads/videos/comercios/${req.file.filename}`),
            videoPosterUrl: null,
            videoPublicId: null,
            videoDuracionSegundos: duracion,
            videoAncho: meta.width,
            videoAlto: meta.height,
            videoBytes: meta.bytes,
            videoFormato: meta.format,
            videoMimeType: meta.mimeType,
          };

      if (cloud) {
        fs.unlink(req.file.path, () => {});
      }

      const comercio = await ComercioService.actualizarVideo(req.usuario.id, datosVideo);
      res.json({ ok: true, comercio });
    } catch (e) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      next(e);
    }
  },

  async quitarVideo(req, res, next) {
    try {
      const comercio = await ComercioService.quitarVideo(req.usuario.id);
      res.json({ ok: true, comercio });
    } catch (e) {
      next(e);
    }
  },

  async misAnaliticas(req, res, next) {
    try {
      const comercio = await ComercioService.obtenerMiComercio(req.usuario.id);
      const comercioId = comercio.id;

      const ahora = new Date();
      const inicioMesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      const inicioMesPasado = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
      const hace6Meses = new Date(ahora.getFullYear(), ahora.getMonth() - 5, 1);
      const hace30Dias = new Date(Date.now() - 30 * 24 * 3600_000);
      const en48h = new Date(Date.now() + 48 * 3600_000);
      const CONFIRMADOS = ["CONFIRMADO", "ENTREGADO"];

      const [
        sumaActual,
        sumaPasado,
        ventasMes,
        pedidosUrgentes,
        productosComercio,
        topVendidos,
        tendenciaRaw,
        reviewStats,
        ofertasProximas,
        reviewsRecientes,
        topVistasRaw,
      ] = await Promise.all([
        prisma.subPedido.aggregate({
          where: { comercioId, createdAt: { gte: inicioMesActual }, pedido: { estado: { in: CONFIRMADOS } } },
          _sum: { neto: true },
        }),
        prisma.subPedido.aggregate({
          where: { comercioId, createdAt: { gte: inicioMesPasado, lt: inicioMesActual }, pedido: { estado: { in: CONFIRMADOS } } },
          _sum: { neto: true },
        }),
        prisma.subPedido.count({
          where: { comercioId, createdAt: { gte: inicioMesActual }, pedido: { estado: { in: CONFIRMADOS } } },
        }),
        prisma.subPedido.count({
          where: { comercioId, estado: { in: ["CONFIRMADO", "EN_PREPARACION"] } },
        }),
        prisma.producto.findMany({
          where: { comercioId, activo: true, deletedAt: null },
          select: { id: true, nombre: true, fotoUrl: true, precio: true, stock: true, stockReservado: true },
        }),
        prisma.pedidoItem.groupBy({
          by: ["productoId"],
          where: { subPedido: { comercioId, createdAt: { gte: hace30Dias }, pedido: { estado: { in: CONFIRMADOS } } } },
          _sum: { cantidad: true, subtotal: true },
          orderBy: { _sum: { subtotal: "desc" } },
          take: 8,
        }),
        prisma.$queryRaw`
          SELECT
            TO_CHAR(s."createdAt" AT TIME ZONE 'America/Bogota', 'YYYY-MM') AS mes,
            COALESCE(SUM(s.neto), 0)::float AS neto,
            COUNT(*)::int AS pedidos
          FROM "SubPedido" s
          JOIN "Pedido" p ON p.id = s."pedidoId"
          WHERE s."comercioId" = ${comercioId}
            AND p.estado IN ('CONFIRMADO', 'ENTREGADO')
            AND s."createdAt" >= ${hace6Meses}
          GROUP BY mes
          ORDER BY mes ASC
        `,
        prisma.reviewProducto.aggregate({
          where: { producto: { comercioId } },
          _avg: { calificacion: true },
          _count: { _all: true },
        }),
        prisma.oferta.findMany({
          where: { producto: { comercioId }, activa: true, fin: { lte: en48h, gte: ahora } },
          include: { producto: { select: { nombre: true } } },
          orderBy: { fin: "asc" },
          take: 3,
        }),
        prisma.reviewProducto.findMany({
          where: { producto: { comercioId } },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            comprador: { select: { nombre: true } },
            producto: { select: { nombre: true } },
          },
        }),
        prisma.$queryRaw`
          SELECT "productoId"::int, COUNT(*)::int AS vistas
          FROM "VistaProducto"
          WHERE "comercioId" = ${comercioId}
            AND "createdAt" >= ${hace30Dias}
          GROUP BY "productoId"
          ORDER BY vistas DESC
        `,
      ]);

      const topIds = topVendidos.map((t) => t.productoId);
      const topInfo = topIds.length
        ? await prisma.producto.findMany({
            where: { id: { in: topIds } },
            select: { id: true, nombre: true, fotoUrl: true, precio: true },
          })
        : [];

      const topMasVendidos = topVendidos.map((t) => ({
        ...topInfo.find((p) => p.id === t.productoId),
        cantidadVendida: t._sum.cantidad ?? 0,
        ingresosGenerados: Number(t._sum.subtotal ?? 0),
      }));

      const stockCritico = productosComercio
        .filter((p) => p.stock - p.stockReservado <= 3)
        .slice(0, 5);

      const vendidosSet = new Set(topIds);
      const sinVentas = productosComercio
        .filter((p) => !vendidosSet.has(p.id))
        .slice(0, 5);

      // Procesamiento de vistas
      const conVistasSet = new Set(topVistasRaw.map((r) => Number(r.productoId)));
      const topVistasIds = topVistasRaw.slice(0, 8).map((r) => Number(r.productoId));
      const topVistasInfo = topVistasIds.length
        ? await prisma.producto.findMany({
            where: { id: { in: topVistasIds } },
            select: { id: true, nombre: true, fotoUrl: true, precio: true },
          })
        : [];
      const topMasVistos = topVistasRaw.slice(0, 8).map((r) => ({
        ...topVistasInfo.find((p) => p.id === Number(r.productoId)),
        vistas: Number(r.vistas),
      }));
      const sinVistas = productosComercio
        .filter((p) => !conVistasSet.has(p.id))
        .slice(0, 5);

      const ingresosActual = Number(sumaActual._sum.neto ?? 0);
      const ingresosPasado = Number(sumaPasado._sum.neto ?? 0);
      const variacionPorcentaje =
        ingresosPasado > 0
          ? ((ingresosActual - ingresosPasado) / ingresosPasado) * 100
          : null;

      const calProm = Number(reviewStats._avg.calificacion ?? 0);
      const totalReviews = reviewStats._count._all ?? 0;

      const insights = [];
      if (pedidosUrgentes > 0) {
        insights.push({ tipo: "urgente", texto: `Tienes ${pedidosUrgentes} pedido${pedidosUrgentes > 1 ? "s" : ""} esperando tu atención.`, accion: { texto: "Ver pedidos", href: "/comerciante/dashboard" } });
      }
      if (stockCritico.length > 0) {
        insights.push({ tipo: "alerta", texto: `${stockCritico.length} producto${stockCritico.length > 1 ? "s tienen" : " tiene"} stock bajo (≤ 3 unidades).`, accion: { texto: "Actualizar stock", href: "/comerciante/dashboard" } });
      }
      if (variacionPorcentaje !== null && variacionPorcentaje >= 20) {
        insights.push({ tipo: "positivo", texto: `¡Tus ingresos subieron ${variacionPorcentaje.toFixed(0)}% comparado con el mes pasado!`, accion: null });
      } else if (variacionPorcentaje !== null && variacionPorcentaje <= -20) {
        insights.push({ tipo: "alerta", texto: `Tus ingresos bajaron ${Math.abs(variacionPorcentaje).toFixed(0)}% este mes. ¿Tienes ofertas activas?`, accion: { texto: "Crear oferta", href: "/comerciante/dashboard" } });
      }
      if (ofertasProximas.length > 0) {
        insights.push({ tipo: "info", texto: `La oferta de "${ofertasProximas[0].producto.nombre}" vence en menos de 48 horas.`, accion: { texto: "Ver ofertas", href: "/comerciante/dashboard" } });
      }
      if (sinVentas.length >= 3) {
        insights.push({ tipo: "info", texto: `${sinVentas.length} productos no tuvieron ventas este mes. Activa una oferta para moverlos.`, accion: { texto: "Ir a ofertas", href: "/comerciante/dashboard" } });
      }
      if (sinVistas.length >= 3) {
        insights.push({ tipo: "info", texto: `${sinVistas.length} productos no recibieron ninguna visita este mes. Mejora sus fotos o actívalos en una oferta.`, accion: { texto: "Ver productos", href: "/comerciante/dashboard" } });
      }
      if (topMasVistos.length > 0 && topMasVistos[0].vistas >= 10) {
        insights.push({ tipo: "positivo", texto: `"${topMasVistos[0].nombre}" es tu producto más visto con ${topMasVistos[0].vistas} visitas este mes.`, accion: null });
      }
      if (calProm >= 4.5 && totalReviews >= 5) {
        insights.push({ tipo: "positivo", texto: `¡Tienda destacada! Tus clientes te dan ${calProm.toFixed(1)} estrellas de 5.`, accion: null });
      }

      const tendenciaMensual = tendenciaRaw.map((r) => ({
        mes: String(r.mes),
        neto: Number(r.neto),
        pedidos: Number(r.pedidos),
      }));

      res.json({
        ok: true,
        data: {
          resumen: { ingresosNetos: ingresosActual, ingresosMesPasado: ingresosPasado, variacionPorcentaje, ventasMes, pedidosUrgentes },
          tendenciaMensual,
          productos: { topMasVendidos, sinVentas, stockCritico },
          vistas: { topMasVistos, sinVistas },
          reputacion: { calificacionPromedio: calProm, totalReviews, reviewsRecientes },
          ofertasProximas,
          insights,
        },
      });
    } catch (e) {
      next(e);
    }
  },

  async misPedidos(req, res, next) {
    try {
      const comercio = await ComercioService.obtenerMiComercio(req.usuario.id);
      const subPedidos = await prisma.subPedido.findMany({
        where: { comercioId: comercio.id },
        orderBy: { pedido: { createdAt: "desc" } },
        include: {
          pedido: {
            select: {
              id: true,
              estado: true,
              createdAt: true,
              direccionTexto: true,
              notas: true,
              comprador: { select: { nombre: true, telefono: true, email: true } },
            },
          },
          items: {
            include: { producto: { select: { nombre: true, fotoUrl: true } } },
          },
        },
      });
      const datos = subPedidos.map(sp => ({
        ...sp,
        subtotal:             Number(sp.subtotal),
        comision:             Number(sp.comision),
        neto:                 Number(sp.neto),
        tasaComisionAplicada: sp.tasaComisionAplicada != null ? Number(sp.tasaComisionAplicada) : null,
        items: (sp.items || []).map(item => ({
          ...item,
          precioUnitario: Number(item.precioUnitario),
          subtotal:       Number(item.subtotal),
        })),
      }));
      res.json({ ok: true, data: datos });
    } catch (e) {
      next(e);
    }
  },

  async actualizarEstadoPedido(req, res, next) {
    try {
      const { ErrorValidacion, ErrorNoEncontrado, ErrorNoAutorizado } = require("../utils/errores");
      const comercio = await ComercioService.obtenerMiComercio(req.usuario.id);
      const subPedidoId = Number(req.params.id);

      const subPedido = await prisma.subPedido.findUnique({
        where: { id: subPedidoId },
        include: { pedido: { select: { id: true, direccionTexto: true } } },
      });
      if (!subPedido) throw new ErrorNoEncontrado("SubPedido no encontrado");
      if (subPedido.comercioId !== comercio.id) throw new ErrorNoAutorizado("No puedes gestionar este pedido");

      const { estado } = req.body;
      // LISTO es el estado terminal desde el lado del comerciante.
      // La Entrega (repartidor) se encarga de avanzar a ENTREGADO.
      const TRANSICIONES = { CONFIRMADO: "EN_PREPARACION", EN_PREPARACION: "LISTO" };
      const estadoActual = subPedido.estado;
      const estadoSiguiente = TRANSICIONES[estadoActual];

      if (!estadoSiguiente || (estado && estado !== estadoSiguiente)) {
        throw new ErrorValidacion(`No puedes cambiar de ${estadoActual} a ${estado || "(desconocido)"}. Transición válida: ${estadoActual} → ${estadoSiguiente || "(ninguna)"}`);
      }

      const actualizado = await prisma.subPedido.update({
        where: { id: subPedidoId },
        data: { estado: estadoSiguiente },
      });

      // Cuando el comerciante marca LISTO, crear Entrega para que un repartidor la tome.
      if (estadoSiguiente === "LISTO") {
        await prisma.entrega.create({
          data: {
            subPedidoId,
            repartidorId: null,
            estado: "ASIGNADA",
            direccion: subPedido.pedido.direccionTexto,
          },
        });
      }

      // Notificaciones y cierre del pedido principal (fire-and-forget).
      if (estadoSiguiente === "LISTO") {
        const pedidoId = subPedido.pedidoId;
        setImmediate(async () => {
          try {
            const pedidoCompleto = await prisma.pedido.findUnique({
              where: { id: pedidoId },
              include: { comprador: { select: { id: true, nombre: true, email: true, telefono: true } } },
            });
            if (!pedidoCompleto) return;

            if (estadoSiguiente === "LISTO") {
              await NotificacionService.pedidoListo({
                pedidoId,
                comprador: pedidoCompleto.comprador,
              });
            }
          } catch (e) {
            console.error("[NOTIF] Error en estado pedido:", e.message);
          }
        });
      }

      res.json({ ok: true, subPedido: actualizado });
    } catch (e) {
      next(e);
    }
  },

  // GET /comercios/mis-estadisticas
  async misEstadisticas(req, res, next) {
    try {
      const comercio = await ComercioService.obtenerMiComercio(req.usuario.id);
      const comercioId = comercio.id;

      const ESTADOS_CONFIRMADOS = ["CONFIRMADO", "ENTREGADO"];

      const [ingresosRes, porPreparar, recientes, topItems] = await Promise.all([
        // Suma de neto en pedidos confirmados
        prisma.subPedido.aggregate({
          where: { comercioId, pedido: { estado: { in: ESTADOS_CONFIRMADOS } } },
          _sum: { neto: true },
        }),
        // Pedidos listos para preparar (pago confirmado)
        prisma.subPedido.findMany({
          where: { comercioId, pedido: { estado: "CONFIRMADO" } },
          orderBy: { pedido: { createdAt: "desc" } },
          take: 10,
          include: {
            pedido: { select: { id: true, estado: true, createdAt: true, direccionTexto: true, comprador: { select: { nombre: true, telefono: true } } } },
            items: { include: { producto: { select: { nombre: true, fotoUrl: true } } } },
          },
        }),
        // Últimos 5 sub-pedidos de cualquier estado
        prisma.subPedido.findMany({
          where: { comercioId },
          orderBy: { pedido: { createdAt: "desc" } },
          take: 5,
          include: {
            pedido: { select: { id: true, estado: true, createdAt: true } },
            items: { include: { producto: { select: { nombre: true } } } },
          },
        }),
        // Top productos más vendidos
        prisma.pedidoItem.groupBy({
          by: ["productoId"],
          where: { subPedido: { comercioId, pedido: { estado: { in: ESTADOS_CONFIRMADOS } } } },
          _sum: { cantidad: true },
          orderBy: { _sum: { cantidad: "desc" } },
          take: 5,
        }),
      ]);

      const productoIds = topItems.map((t) => t.productoId);
      const productos = productoIds.length
        ? await prisma.producto.findMany({
            where: { id: { in: productoIds } },
            select: { id: true, nombre: true, fotoUrl: true },
          })
        : [];

      const topProductos = topItems.map((t) => ({
        ...productos.find((p) => p.id === t.productoId),
        cantidadVendida: t._sum.cantidad ?? 0,
      }));

      res.json({
        ok: true,
        data: {
          ingresosNetos: Number(ingresosRes._sum.neto ?? 0),
          porPreparar,
          recientes,
          topProductos,
        },
      });
    } catch (e) {
      next(e);
    }
  },
  async misLiquidaciones(req, res, next) {
    try {
      const comercio = await ComercioService.obtenerMiComercio(req.usuario.id);
      const liquidaciones = await prisma.liquidacion.findMany({
        where: { beneficiarioId: comercio.usuarioId, tipo: "COMERCIANTE" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          tipo: true,
          monto: true,
          estado: true,
          periodoDesde: true,
          periodoHasta: true,
          cuentaDestino: true,
          comprobante: true,
          notas: true,
          createdAt: true,
          pagadoAt: true,
        },
      });
      const datos = liquidaciones.map((l) => ({
        ...l,
        monto: Number(l.monto),
      }));
      res.json({ ok: true, data: datos });
    } catch (e) {
      next(e);
    }
  },

  subirDocumento(req, res, next) {
    _uploadDoc(req, res, async (err) => {
      if (err) return next(err);
      if (!req.file) return res.status(400).json({ ok: false, error: "No se recibió imagen." });
      try {
        const base = `${req.protocol}://${req.get("host")}`;
        const url = `${base}/uploads/documentos/${req.file.filename}`;
        const comercio = await prisma.comercio.update({
          where: { usuarioId: req.usuario.id },
          data: { fotoDocumentoUrl: url },
        });
        res.json({ ok: true, url, comercio });
      } catch (e) {
        next(e);
      }
    });
  },
};

module.exports = ComercioController;

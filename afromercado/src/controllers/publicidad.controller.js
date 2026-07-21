const prisma = require("../config/prisma");
const { ErrorValidacion, ErrorNoEncontrado, ErrorProhibido } = require("../utils/errores");
const { generarExcelAfroMedia } = require("../services/reporteExcel.service");
const PagoPublicidadService = require("../services/pago-publicidad.service");
const VisibilidadService = require("../services/visibilidad.service");
const NotificacionService = require("../services/notificacion.service");

async function registrarAuditoria({ tipo, entidad, entidadId = null, usuarioId = null, datos = null, ip = null }) {
  try {
    await prisma.auditoriaAfroMedia.create({
      data: {
        tipo,
        entidad,
        entidadId: entidadId ? Number(entidadId) : null,
        usuarioId: usuarioId ? Number(usuarioId) : null,
        datos: datos ?? undefined,
        ip: ip ? String(ip).slice(0, 120) : null,
      },
    });
  } catch {
    // auditoría no bloquea la operación principal
  }
}

const DEFAULT_PAQUETES = [
  {
    codigo: "IMPULSO_PRODUCTO",
    nombre: "Impulso Producto",
    descripcion: "Aparece como producto patrocinado en catalogo y categorias relevantes.",
    ideal: "Para vender stock disponible rapido.",
    precioBaseCOP: 15000,
    duracionDias: 7,
    cuposSugeridos: 12,
    activo: true,
    recomendado: true,
    orden: 10,
    color: "from-[#2D6A4F] to-[#52B788]",
  },
  {
    codigo: "HOME_DESTACADO",
    nombre: "Home Destacado",
    descripcion: "Visibilidad fuerte en la portada, con contexto de tienda o producto.",
    ideal: "Para lanzamientos, temporada o productos estrella.",
    precioBaseCOP: 35000,
    duracionDias: 7,
    cuposSugeridos: 6,
    activo: true,
    recomendado: true,
    orden: 20,
    color: "from-[#9B7300] to-[#D4A017]",
  },
  {
    codigo: "VIDEO_HISTORIA",
    nombre: "Video Historia",
    descripcion: "Destaca un video corto de tu finca, cocina, taller, tienda o producto.",
    ideal: "Para turismo, gastronomia y productos con historia.",
    precioBaseCOP: 45000,
    duracionDias: 10,
    cuposSugeridos: 4,
    activo: true,
    recomendado: false,
    orden: 30,
    color: "from-[#7B241C] to-[#C0392B]",
  },
  {
    codigo: "TEMPORADA_REGIONAL",
    nombre: "Temporada Regional",
    descripcion: "Participa en rutas y vitrinas regionales como Sabores del Pacifico, Artesanias del Choco o Cafe del Eje.",
    ideal: "Para vender por region, cultura o temporada.",
    precioBaseCOP: 60000,
    duracionDias: 14,
    cuposSugeridos: 5,
    activo: true,
    recomendado: false,
    orden: 40,
    color: "from-[#1A1A1A] to-[#2D6A4F]",
  },
  {
    codigo: "MARCA_ALIADA",
    nombre: "Marca Aliada",
    descripcion: "Campana de posicionamiento para aliados, instituciones o marcas con afinidad cultural.",
    ideal: "Para patrocinios, alianzas y contenido institucional.",
    precioBaseCOP: 90000,
    duracionDias: 15,
    cuposSugeridos: 3,
    activo: true,
    recomendado: false,
    orden: 50,
    color: "from-[#102018] to-[#D4A017]",
  },
  {
    codigo: "BANNER_CARRUSEL",
    nombre: "Banner Carrusel",
    descripcion: "Banner diseñado a la medida que rota en el carrusel principal del home.",
    ideal: "Para marcas con una pieza grafica propia lista para destacar.",
    precioBaseCOP: 40000,
    duracionDias: 10,
    cuposSugeridos: 4,
    activo: true,
    recomendado: false,
    orden: 60,
    color: "from-[#2D6A4F] to-[#1B4332]",
  },
  {
    codigo: "IRRUPTOR_BIENVENIDA",
    nombre: "Irruptor de Bienvenida",
    descripcion: "Imagen a pantalla completa que se superpone al abrir la app. Formato premium, un solo cupo nacional a la vez.",
    ideal: "Para lanzamientos de alto impacto que necesitan maxima visibilidad.",
    precioBaseCOP: 120000,
    duracionDias: 7,
    cuposSugeridos: 1,
    activo: true,
    recomendado: false,
    orden: 70,
    color: "from-[#7B241C] to-[#1A1A1A]",
  },
];

const PAQUETES = new Set(DEFAULT_PAQUETES.map((p) => p.codigo));

const ESTADOS = new Set(["PENDIENTE", "APROBADA", "RECHAZADA", "CONVERTIDA"]);
const PAQUETES_VISIBILIDAD = new Set(["IMPULSO_PRODUCTO", "HOME_DESTACADO"]);
// Paquetes que requieren una imagen diseñada propia (no reusan foto de producto ni logo de comercio).
const PAQUETES_IMAGEN_PERSONALIZADA = new Set(["BANNER_CARRUSEL", "IRRUPTOR_BIENVENIDA"]);
const POLITICA_PUBLICIDAD_VERSION = "2026-06-27";

// Alcance geográfico de una pauta: a mayor cobertura, mayor multiplicador sobre el precio base del paquete.
const ALCANCES = new Set(["MUNICIPIO", "DEPARTAMENTO", "NACIONAL"]);
const MULTIPLICADOR_ALCANCE = {
  MUNICIPIO: 1.0,
  DEPARTAMENTO: 2.3,
  NACIONAL: 4.5,
};

function parseAlcance(valor) {
  const alcance = limpiarTexto(valor, 20).toUpperCase() || "NACIONAL";
  if (!ALCANCES.has(alcance)) throw new ErrorValidacion("Alcance inválido. Usa MUNICIPIO, DEPARTAMENTO o NACIONAL.");
  return alcance;
}

function limpiarTexto(valor, max = 1000) {
  if (valor === undefined || valor === null) return "";
  return String(valor).trim().slice(0, max);
}

function parseFecha(valor, campo) {
  if (!valor) return null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) throw new ErrorValidacion(`${campo} no es una fecha valida.`);
  return fecha;
}

function parseMonto(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) throw new ErrorValidacion("El presupuesto debe ser un numero positivo.");
  return n;
}

function parseEntero(valor, campo, { min = 0, nullable = false } = {}) {
  if (valor === undefined || valor === null || valor === "") {
    if (nullable) return null;
    throw new ErrorValidacion(`${campo} es requerido.`);
  }
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min) throw new ErrorValidacion(`${campo} debe ser un numero entero valido.`);
  return n;
}

function parseBoolean(valor) {
  if (typeof valor === "boolean") return valor;
  if (valor === "true") return true;
  if (valor === "false") return false;
  return Boolean(valor);
}

function fechaQuery(valor, finDelDia = false) {
  if (!valor) return null;
  const texto = String(valor);
  const fecha = new Date(texto.length === 10 ? `${texto}T00:00:00.000Z` : texto);
  if (Number.isNaN(fecha.getTime())) throw new ErrorValidacion("Las fechas deben ser validas.");
  if (finDelDia && texto.length === 10) fecha.setUTCHours(23, 59, 59, 999);
  return fecha;
}

function rangoFechas(query = {}) {
  const desde = fechaQuery(query.desde);
  const hasta = fechaQuery(query.hasta, true);
  if (desde && hasta && desde > hasta) throw new ErrorValidacion("'desde' no puede ser posterior a 'hasta'.");
  return { desde, hasta };
}

function whereCreatedAt({ desde, hasta }) {
  const createdAt = {};
  if (desde) createdAt.gte = desde;
  if (hasta) createdAt.lte = hasta;
  return Object.keys(createdAt).length ? { createdAt } : {};
}

// Reconstruye vistas/clics/conversiones/gmv por anuncio agregando
// MetricaPublicitaria (Teravia Ads) — reemplaza los contadores denormalizados
// que tenían CampanaHero/VisibilidadPagada en el sistema anterior. Nota: el
// nuevo TipoMetricaAnuncio no distingue "agregado al carrito" como evento
// propio (solo IMPRESION/CLIC/CONVERSION_COMPRA/POSTULACION_EMPLEO), así que
// "carritos" queda en 0 y "unidadesAtribuidas" se aproxima con el conteo de
// conversiones — simplificación deliberada del refactor, no un bug de este fix.
async function agregarMetricasPorAnuncio(anuncioIds) {
  const mapa = new Map(anuncioIds.map((id) => [id, { vistas: 0, clics: 0, carritos: 0, pedidosAtribuidos: 0, gmvAtribuido: 0 }]));
  if (anuncioIds.length === 0) return mapa;
  const grupos = await prisma.metricaPublicitaria.groupBy({
    by: ["anuncioId", "tipoEvento"],
    where: { anuncioId: { in: anuncioIds } },
    _count: { _all: true },
    _sum: { valorAtribuido: true },
  });
  for (const g of grupos) {
    const fila = mapa.get(g.anuncioId);
    if (!fila) continue;
    if (g.tipoEvento === "IMPRESION") fila.vistas = g._count._all;
    else if (g.tipoEvento === "CLIC") fila.clics = g._count._all;
    else if (g.tipoEvento === "CARRITO") fila.carritos = g._count._all;
    else if (g.tipoEvento === "CONVERSION_COMPRA") {
      fila.pedidosAtribuidos = g._count._all;
      fila.gmvAtribuido = Number(g._sum.valorAtribuido || 0);
    }
  }
  return mapa;
}

function selectPaqueteConfig() {
  return {
    id: true,
    codigo: true,
    nombre: true,
    descripcion: true,
    ideal: true,
    precioBaseCOP: true,
    duracionDias: true,
    cuposSugeridos: true,
    activo: true,
    recomendado: true,
    orden: true,
    color: true,
    updatedAt: true,
  };
}

async function asegurarPaquetesPublicidad() {
  for (const paquete of DEFAULT_PAQUETES) {
    await prisma.publicidadPaqueteConfig.upsert({
      where: { codigo: paquete.codigo },
      update: {},
      create: paquete,
    });
  }
}

async function listarPaquetesConfig({ soloActivos = false } = {}) {
  await asegurarPaquetesPublicidad();
  const paquetes = await prisma.publicidadPaqueteConfig.findMany({
    where: soloActivos ? { activo: true } : {},
    orderBy: [{ orden: "asc" }, { id: "asc" }],
    select: selectPaqueteConfig(),
  });
  return agregarDisponibilidadPaquetes(paquetes);
}

function ventanaPublicidad({ inicio, fin }, paqueteConfig) {
  const inicioReal = inicio || new Date();
  let finReal = fin || new Date(inicioReal.getTime() + Number(paqueteConfig?.duracionDias || 7) * 24 * 3600_000);
  if (finReal <= inicioReal) finReal = new Date(inicioReal.getTime() + Number(paqueteConfig?.duracionDias || 7) * 24 * 3600_000);
  return { inicio: inicioReal, fin: finReal };
}

function ventanasSeCruzan(a, b) {
  return a.inicio < b.fin && b.inicio < a.fin;
}

async function ocupacionPaquete(paqueteConfig, ventana, { excluirSolicitudId = null } = {}) {
  const cupos = Number(paqueteConfig.cuposSugeridos || 0);
  const [solicitudes, pendientesRevision] = await Promise.all([
    prisma.solicitudPublicidad.findMany({
      where: {
        paquete: paqueteConfig.codigo,
        estado: { in: ["APROBADA", "CONVERTIDA"] },
        ...(excluirSolicitudId ? { id: { not: Number(excluirSolicitudId) } } : {}),
      },
      select: { id: true, inicio: true, fin: true, createdAt: true },
    }),
    prisma.solicitudPublicidad.count({
      where: { paquete: paqueteConfig.codigo, estado: "PENDIENTE" },
    }),
  ]);

  const ocupados = solicitudes.filter((s) => {
    const inicio = s.inicio || s.createdAt || new Date();
    const fin = s.fin || new Date(inicio.getTime() + Number(paqueteConfig.duracionDias || 7) * 24 * 3600_000);
    return ventanasSeCruzan({ inicio, fin }, ventana);
  }).length;

  return {
    cupos,
    cuposOcupados: ocupados,
    cuposDisponibles: cupos > 0 ? Math.max(0, cupos - ocupados) : null,
    cupoLleno: cupos > 0 && ocupados >= cupos,
    pendientesRevision,
  };
}

async function agregarDisponibilidadPaquetes(paquetes) {
  return Promise.all(paquetes.map(async (paquete) => {
    const ventana = ventanaPublicidad({}, paquete);
    const ocupacion = await ocupacionPaquete(paquete, ventana);
    return { ...paquete, ...ocupacion };
  }));
}

async function validarCupoDisponible(paqueteConfig, ventana, { excluirSolicitudId = null } = {}) {
  const ocupacion = await ocupacionPaquete(paqueteConfig, ventana, { excluirSolicitudId });
  if (ocupacion.cupoLleno) {
    throw new ErrorValidacion(
      `El paquete ${paqueteConfig.nombre} no tiene cupos disponibles para esas fechas (${ocupacion.cuposOcupados}/${ocupacion.cupos}).`,
    );
  }
  return ocupacion;
}

function fechaInicioFin(solicitud) {
  const inicio = solicitud.inicio || new Date();
  let fin = solicitud.fin || new Date(inicio.getTime() + 7 * 24 * 3600_000);
  if (fin <= inicio) fin = new Date(inicio.getTime() + 7 * 24 * 3600_000);
  return { inicio, fin };
}

function destinoSolicitud(solicitud) {
  if (solicitud.productoId) return `/producto/${solicitud.productoId}`;
  return `/comercio/${solicitud.comercioId}`;
}

function imagenParaCampana(solicitud) {
  return solicitud.producto?.fotoUrl || solicitud.comercio?.logoUrl || null;
}

function ctaPorPaquete(paquete) {
  if (paquete === "VIDEO_HISTORIA") return "Ver historia";
  if (paquete === "TEMPORADA_REGIONAL") return "Explorar ruta";
  if (paquete === "MARCA_ALIADA") return "Conocer mas";
  return "Ver mas";
}

function tituloCampana(solicitud) {
  if (solicitud.producto?.nombre) return solicitud.producto.nombre;
  return solicitud.comercio?.nombre || "Campana AfroMedia";
}

function selectSolicitud() {
  return {
    id: true,
    paquete: true,
    objetivo: true,
    presupuestoCOP: true,
    alcance: true,
    departamento: true,
    municipio: true,
    inicio: true,
    fin: true,
    mensaje: true,
    estado: true,
    notasAdmin: true,
    politicaAceptada: true,
    politicaVersion: true,
    politicaAceptadaAt: true,
    pagoEstado: true,
    pagoMontoCOP: true,
    pagoReferencia: true,
    pagoProveedor: true,
    pagoCheckoutUrl: true,
    pagoProviderPaymentId: true,
    pagoProviderReference: true,
    pagoProviderStatus: true,
    pagoConfirmadoAt: true,
    pagoExpiraAt: true,
    pagoNotas: true,
    pagoActualizadoAt: true,
    videoUrl: true,
    videoPortadaUrl: true,
    videoTexto: true,
    videoUbicacion: true,
    videoDestino: true,
    videoNotasComercio: true,
    videoAprobado: true,
    videoNotasRevision: true,
    videoRevisadoAt: true,
    imagenPersonalizadaUrl: true,
    revisadoAt: true,
    createdAt: true,
    updatedAt: true,
    comercio: {
      select: {
        id: true,
        nombre: true,
        municipio: true,
        estadoRegistro: true,
        verificado: true,
        usuario: { select: { nombre: true, email: true, telefono: true } },
      },
    },
    producto: { select: { id: true, nombre: true, fotoUrl: true, precio: true, stock: true, activo: true } },
    adminRevisor: { select: { id: true, nombre: true } },
  };
}

async function comercioDelUsuario(usuarioId) {
  return prisma.comercio.findUnique({
    where: { usuarioId },
    include: {
      cuentaDispersion: { select: { estado: true, proveedor: true } },
    },
  });
}

function porcentaje(numerador, denominador) {
  return denominador > 0 ? numerador / denominador : 0;
}

function crearFilaAgrupada(clave, nombre, extra = {}) {
  return {
    clave,
    nombre,
    pautas: 0,
    vistas: 0,
    clics: 0,
    carritos: 0,
    pedidosAtribuidos: 0,
    unidadesAtribuidas: 0,
    gmvAtribuido: 0,
    inversionRegistrada: 0,
    ctr: 0,
    conversionCarrito: 0,
    roas: 0,
    ...extra,
  };
}

function sumarMetricaFila(fila, pauta) {
  fila.pautas += 1;
  fila.vistas += Number(pauta.vistas || 0);
  fila.clics += Number(pauta.clics || 0);
  fila.carritos += Number(pauta.carritos || 0);
  fila.pedidosAtribuidos += Number(pauta.pedidosAtribuidos || 0);
  fila.unidadesAtribuidas += Number(pauta.unidadesAtribuidas || 0);
  fila.gmvAtribuido += Number(pauta.gmvAtribuido || 0);
  fila.inversionRegistrada += Number(pauta.montoCOP || 0);
}

function finalizarFila(fila) {
  return {
    ...fila,
    ctr: porcentaje(fila.clics, fila.vistas),
    conversionCarrito: porcentaje(fila.carritos, fila.clics),
    roas: porcentaje(fila.gmvAtribuido, fila.inversionRegistrada),
  };
}

function ordenarFilas(map, limite = 12) {
  return Array.from(map.values())
    .map(finalizarFila)
    .sort((a, b) => b.gmvAtribuido - a.gmvAtribuido || b.clics - a.clics || b.vistas - a.vistas)
    .slice(0, limite);
}

function construirAnaliticaAfroMedia({ visibilidades, solicitudes, campanas, paquetes }) {
  const porRegion = new Map();
  const porCategoria = new Map();
  const porProducto = new Map();
  const porComercio = new Map();
  const porPaquete = new Map();

  for (const paquete of paquetes) {
      porPaquete.set(paquete.codigo, {
        codigo: paquete.codigo,
        nombre: paquete.nombre,
        solicitudes: 0,
        pendientes: 0,
        aprobadas: 0,
        convertidas: 0,
        rechazadas: 0,
        presupuestoSolicitado: 0,
        pagadas: 0,
        pendientesPago: 0,
        ingresoPagado: 0,
        ingresoPendiente: 0,
        activo: paquete.activo,
      });
    }

  for (const solicitud of solicitudes) {
    if (!porPaquete.has(solicitud.paquete)) {
      porPaquete.set(solicitud.paquete, {
        codigo: solicitud.paquete,
        nombre: solicitud.paquete,
        solicitudes: 0,
        pendientes: 0,
        aprobadas: 0,
        convertidas: 0,
        rechazadas: 0,
        presupuestoSolicitado: 0,
        pagadas: 0,
        pendientesPago: 0,
        ingresoPagado: 0,
        ingresoPendiente: 0,
        activo: false,
      });
    }
    const fila = porPaquete.get(solicitud.paquete);
    fila.solicitudes += 1;
    fila.presupuestoSolicitado += Number(solicitud.presupuestoCOP || 0);
    if (PagoPublicidadService.pagoActivable(solicitud.pagoEstado)) {
      fila.pagadas += 1;
      fila.ingresoPagado += Number(solicitud.pagoMontoCOP || solicitud.presupuestoCOP || 0);
    } else if (solicitud.estado === "APROBADA") {
      fila.pendientesPago += 1;
      fila.ingresoPendiente += Number(solicitud.pagoMontoCOP || solicitud.presupuestoCOP || 0);
    }
    if (solicitud.estado === "PENDIENTE") fila.pendientes += 1;
    else if (solicitud.estado === "APROBADA") fila.aprobadas += 1;
    else if (solicitud.estado === "CONVERTIDA") fila.convertidas += 1;
    else if (solicitud.estado === "RECHAZADA") fila.rechazadas += 1;
  }

  for (const pauta of visibilidades) {
    const region = pauta.comercio?.municipio || "Sin municipio";
    if (!porRegion.has(region)) porRegion.set(region, crearFilaAgrupada(region, region));
    sumarMetricaFila(porRegion.get(region), pauta);

    const categoria = pauta.producto?.categoria?.nombre || "Sin categoria";
    if (!porCategoria.has(categoria)) porCategoria.set(categoria, crearFilaAgrupada(categoria, categoria));
    sumarMetricaFila(porCategoria.get(categoria), pauta);

    const comercioClave = String(pauta.comercioId);
    if (!porComercio.has(comercioClave)) {
      porComercio.set(comercioClave, crearFilaAgrupada(comercioClave, pauta.comercio?.nombre || `Comercio #${pauta.comercioId}`, {
        comercioId: pauta.comercioId,
        municipio: pauta.comercio?.municipio || null,
      }));
    }
    sumarMetricaFila(porComercio.get(comercioClave), pauta);

    const productoClave = pauta.productoId ? String(pauta.productoId) : `tienda-${pauta.comercioId}`;
    if (!porProducto.has(productoClave)) {
      porProducto.set(productoClave, crearFilaAgrupada(productoClave, pauta.producto?.nombre || "Tienda completa", {
        productoId: pauta.productoId,
        comercioId: pauta.comercioId,
        comercio: pauta.comercio?.nombre || null,
        municipio: pauta.comercio?.municipio || null,
        categoria,
      }));
    }
    sumarMetricaFila(porProducto.get(productoClave), pauta);
  }

  const campanasResumen = campanas.map((c) => ({
    id: c.id,
    tipo: c.tipo,
    titulo: c.titulo,
    vistas: c.vistas,
    clics: c.clics,
    montoCOP: Number(c.montoCOP || 0),
    ctr: porcentaje(c.clics, c.vistas),
    inicio: c.inicio,
    fin: c.fin,
    activa: c.activa,
  }));

  return {
    porRegion: ordenarFilas(porRegion, 20),
    porCategoria: ordenarFilas(porCategoria, 20),
    porProducto: ordenarFilas(porProducto, 30),
    porComercio: ordenarFilas(porComercio, 20),
    porPaquete: Array.from(porPaquete.values()).sort((a, b) => b.solicitudes - a.solicitudes || a.nombre.localeCompare(b.nombre)),
    campanas: campanasResumen,
  };
}

async function obtenerDatosAfroMedia({ desde = null, hasta = null } = {}) {
  const filtro = whereCreatedAt({ desde, hasta });
  const [paquetes, solicitudes, anunciosProductos, anunciosVitrina] = await Promise.all([
    listarPaquetesConfig(),
    prisma.solicitudPublicidad.findMany({
      where: filtro,
      orderBy: { createdAt: "desc" },
      select: selectSolicitud(),
    }),
    // Reemplaza VisibilidadPagada: anuncios nativos dentro del catálogo de productos.
    // `productoId` es un Int suelto (sin relación Prisma declarada en
    // AnuncioUbicacion) — el producto se resuelve aparte más abajo, no con `include`.
    prisma.anuncioUbicacion.findMany({
      where: { modulo: "PRODUCTOS", ...filtro },
      orderBy: { createdAt: "desc" },
      include: {
        campana: { select: { presupuestoTotal: true, comercioId: true } },
      },
    }),
    // Reemplaza CampanaHero: banners/irruptor/video del hero y la Vitrina.
    prisma.anuncioUbicacion.findMany({
      where: { modulo: "VITRINA", ...filtro },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, tipoCampana: true, formato: true, titulo: true, activa: true, createdAt: true,
        campana: { select: { presupuestoTotal: true, inicio: true, fin: true } },
      },
    }),
  ]);

  const comercioIds = [...new Set(anunciosProductos.map((a) => a.campana?.comercioId).filter(Boolean))];
  const comercios = comercioIds.length
    ? await prisma.comercio.findMany({ where: { id: { in: comercioIds } }, select: { id: true, nombre: true, municipio: true } })
    : [];
  const comercioPorId = new Map(comercios.map((c) => [c.id, c]));

  const productoIds = [...new Set(anunciosProductos.map((a) => a.productoId).filter(Boolean))];
  const productos = productoIds.length
    ? await prisma.producto.findMany({
        where: { id: { in: productoIds } },
        select: { id: true, nombre: true, categoria: { select: { id: true, nombre: true, slug: true } } },
      })
    : [];
  const productoPorId = new Map(productos.map((p) => [p.id, p]));

  const metricas = await agregarMetricasPorAnuncio([
    ...anunciosProductos.map((a) => a.id),
    ...anunciosVitrina.map((a) => a.id),
  ]);

  const visibilidades = anunciosProductos.map((a) => {
    const m = metricas.get(a.id) || { vistas: 0, clics: 0, carritos: 0, pedidosAtribuidos: 0, gmvAtribuido: 0 };
    return {
      id: a.id,
      comercioId: a.campana?.comercioId ?? null,
      comercio: a.campana?.comercioId ? comercioPorId.get(a.campana.comercioId) ?? null : null,
      productoId: a.productoId,
      producto: a.productoId ? productoPorId.get(a.productoId) ?? null : null,
      vistas: m.vistas,
      clics: m.clics,
      carritos: m.carritos,
      pedidosAtribuidos: m.pedidosAtribuidos,
      unidadesAtribuidas: m.pedidosAtribuidos,
      gmvAtribuido: m.gmvAtribuido,
      montoCOP: Number(a.campana?.presupuestoTotal || 0),
      inicio: a.createdAt,
      fin: a.createdAt,
      activa: a.activa,
      createdAt: a.createdAt,
    };
  });

  const campanas = anunciosVitrina.map((a) => {
    const m = metricas.get(a.id) || { vistas: 0, clics: 0 };
    return {
      id: a.id,
      tipo: a.tipoCampana || (a.formato === "VIDEO" ? "VIDEO_HISTORIA" : "PUBLICIDAD"),
      titulo: a.titulo,
      vistas: m.vistas,
      clics: m.clics,
      montoCOP: Number(a.campana?.presupuestoTotal || 0),
      inicio: a.campana?.inicio ?? a.createdAt,
      fin: a.campana?.fin ?? a.createdAt,
      activa: a.activa,
      createdAt: a.createdAt,
    };
  });

  return {
    paquetes,
    solicitudes,
    visibilidades,
    campanas,
    analitica: construirAnaliticaAfroMedia({ visibilidades, solicitudes, campanas, paquetes }),
  };
}


const PublicidadController = {
  async politicas(req, res, next) {
    try {
      res.json({
        ok: true,
        data: {
          version: POLITICA_PUBLICIDAD_VERSION,
          url: "/publicidad/politicas",
          resumen: [
            "Todo contenido pagado debe identificarse como Patrocinado o Publicidad.",
            "No se aceptan promesas falsas, productos ilegales ni mensajes discriminatorios.",
            "Solo se pautan comercios verificados, con cuenta de dispersion verificada y productos con stock.",
            "Teravia puede rechazar o suspender una pauta si afecta la confianza de la comunidad.",
          ],
        },
      });
    } catch (err) { next(err); }
  },

  async listarPaquetes(req, res, next) {
    try {
      const data = await listarPaquetesConfig({ soloActivos: true });
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async listarPaquetesAdmin(req, res, next) {
    try {
      const data = await listarPaquetesConfig();
      res.json({ ok: true, data });
    } catch (err) { next(err); }
  },

  async actualizarPaqueteAdmin(req, res, next) {
    try {
      const codigo = limpiarTexto(req.params.codigo, 80).toUpperCase();
      if (!PAQUETES.has(codigo)) throw new ErrorValidacion("Paquete de publicidad no valido.");

      await asegurarPaquetesPublicidad();
      const existe = await prisma.publicidadPaqueteConfig.findUnique({ where: { codigo } });
      if (!existe) throw new ErrorNoEncontrado("Paquete de publicidad no encontrado.");

      const data = {};
      if (req.body.nombre !== undefined) data.nombre = limpiarTexto(req.body.nombre, 120);
      if (req.body.descripcion !== undefined) data.descripcion = limpiarTexto(req.body.descripcion, 500) || null;
      if (req.body.ideal !== undefined) data.ideal = limpiarTexto(req.body.ideal, 300) || null;
      if (req.body.precioBaseCOP !== undefined) data.precioBaseCOP = parseMonto(req.body.precioBaseCOP) || 0;
      if (req.body.duracionDias !== undefined) data.duracionDias = parseEntero(req.body.duracionDias, "duracionDias", { min: 1 });
      if (req.body.cuposSugeridos !== undefined) data.cuposSugeridos = parseEntero(req.body.cuposSugeridos, "cuposSugeridos", { min: 0, nullable: true });
      if (req.body.activo !== undefined) data.activo = parseBoolean(req.body.activo);
      if (req.body.recomendado !== undefined) data.recomendado = parseBoolean(req.body.recomendado);
      if (req.body.orden !== undefined) data.orden = parseEntero(req.body.orden, "orden", { min: 0 });
      if (req.body.color !== undefined) data.color = limpiarTexto(req.body.color, 120) || null;

      if (data.nombre !== undefined && !data.nombre) throw new ErrorValidacion("El nombre del paquete es requerido.");

      const paquete = await prisma.publicidadPaqueteConfig.update({
        where: { codigo },
        data,
        select: selectPaqueteConfig(),
      });

      await registrarAuditoria({
        tipo: "PAQUETE_ACTUALIZADO",
        entidad: "PublicidadPaqueteConfig",
        entidadId: paquete.id,
        usuarioId: req.usuario.id,
        datos: { codigo, cambios: data },
        ip: limpiarTexto(req.headers["x-forwarded-for"] || req.ip, 120),
      });

      res.json({ ok: true, data: paquete });
    } catch (err) { next(err); }
  },

  async crearSolicitud(req, res, next) {
    try {
      const comercio = await comercioDelUsuario(req.usuario.id);
      if (!comercio) throw new ErrorNoEncontrado("Primero registra tu comercio.");
      if (comercio.estadoRegistro !== "APROBADO" || !comercio.verificado) {
        throw new ErrorProhibido("Tu comercio debe estar aprobado y verificado antes de solicitar publicidad.");
      }
      if (!comercio.cuentaDispersion || comercio.cuentaDispersion.estado !== "VERIFICADA") {
        throw new ErrorProhibido("Debes tener una cuenta de dispersion verificada antes de solicitar publicidad.");
      }

      const paquete = limpiarTexto(req.body.paquete, 80);
      const objetivo = limpiarTexto(req.body.objetivo, 160);
      const mensaje = limpiarTexto(req.body.mensaje, 1200);
      const productoId = req.body.productoId ? Number(req.body.productoId) : null;
      const alcance = parseAlcance(req.body.alcance);
      // El presupuesto final se calcula desde el precio base del paquete y el alcance elegido;
      // no se confía en un presupuestoCOP enviado por el cliente para evitar manipulación del cobro.
      let departamento = alcance !== "NACIONAL" ? (limpiarTexto(req.body.departamento, 120) || comercio.departamento || null) : null;
      let municipio = alcance === "MUNICIPIO" ? (limpiarTexto(req.body.municipio, 120) || comercio.municipio || null) : null;
      if (alcance === "DEPARTAMENTO" && !departamento) {
        throw new ErrorValidacion("Selecciona el departamento para una pauta de alcance DEPARTAMENTO.");
      }
      if (alcance === "MUNICIPIO" && (!departamento || !municipio)) {
        throw new ErrorValidacion("Selecciona el municipio (y su departamento) para una pauta de alcance MUNICIPIO.");
      }
      let inicio = parseFecha(req.body.inicio, "inicio");
      let fin = parseFecha(req.body.fin, "fin");
      const aceptaPoliticas = req.body.aceptaPoliticas === true || req.body.aceptaPoliticas === "true";
      const videoUrl = limpiarTexto(req.body.videoUrl, 800) || null;
      const videoPortadaUrl = limpiarTexto(req.body.videoPortadaUrl, 800) || null;
      const videoTexto = limpiarTexto(req.body.videoTexto, 600) || null;
      const videoUbicacion = limpiarTexto(req.body.videoUbicacion, 80) || null;
      const videoDestino = limpiarTexto(req.body.videoDestino, 400) || null;
      const videoNotasComercio = limpiarTexto(req.body.videoNotasComercio, 1200) || null;
      const imagenPersonalizadaUrl = limpiarTexto(req.body.imagenPersonalizadaUrl, 800) || null;

      if (!PAQUETES.has(paquete)) throw new ErrorValidacion("Selecciona un paquete de publicidad valido.");
      const paquetesActivos = await listarPaquetesConfig({ soloActivos: true });
      const paqueteConfig = paquetesActivos.find((p) => p.codigo === paquete);
      if (!paqueteConfig) throw new ErrorValidacion("El paquete seleccionado no esta activo en AfroMedia.");
      if (!aceptaPoliticas) {
        throw new ErrorValidacion("Debes aceptar las politicas de publicidad de AfroMedia antes de enviar la solicitud.");
      }
      if (!objetivo) throw new ErrorValidacion("El objetivo de la campana es requerido.");
      if (!inicio) inicio = new Date();
      if (!fin) fin = new Date(inicio.getTime() + Number(paqueteConfig.duracionDias || 7) * 24 * 3600_000);
      if (inicio && fin && fin <= inicio) throw new ErrorValidacion("La fecha final debe ser posterior a la inicial.");
      await validarCupoDisponible(paqueteConfig, { inicio, fin });

      let producto = null;
      if (productoId) {
        producto = await prisma.producto.findFirst({
          where: { id: productoId, comercioId: comercio.id },
          select: { id: true, activo: true, stock: true },
        });
        if (!producto) throw new ErrorValidacion("El producto seleccionado no pertenece a tu comercio.");
        if (!producto.activo || producto.stock <= 0) {
          throw new ErrorValidacion("El producto debe estar activo y con stock para pautarlo.");
        }
      }

      const multiplicador = MULTIPLICADOR_ALCANCE[alcance];
      const presupuestoCOP = Math.round(Number(paqueteConfig.precioBaseCOP || 0) * multiplicador);

      const solicitud = await prisma.solicitudPublicidad.create({
        data: {
          comercioId: comercio.id,
          productoId,
          paquete,
          objetivo,
          presupuestoCOP,
          alcance,
          departamento,
          municipio,
          pagoEstado: "PENDIENTE",
          pagoMontoCOP: presupuestoCOP,
          inicio,
          fin,
          mensaje: mensaje || null,
          politicaAceptada: true,
          politicaVersion: POLITICA_PUBLICIDAD_VERSION,
          politicaAceptadaAt: new Date(),
          politicaIp: limpiarTexto(req.headers["x-forwarded-for"] || req.ip, 120) || null,
          videoUrl,
          videoPortadaUrl,
          videoTexto,
          videoUbicacion,
          videoDestino,
          videoNotasComercio,
          imagenPersonalizadaUrl,
        },
        select: selectSolicitud(),
      });

      await registrarAuditoria({
        tipo: "SOLICITUD_CREADA",
        entidad: "SolicitudPublicidad",
        entidadId: solicitud.id,
        usuarioId: req.usuario.id,
        datos: { paquete, objetivo, presupuestoCOP: solicitud.presupuestoCOP, alcance, departamento, municipio },
        ip: limpiarTexto(req.headers["x-forwarded-for"] || req.ip, 120),
      });

      NotificacionService.solicitudPublicidadCreada({ solicitud, comercioNombre: comercio.nombre })
        .catch((e) => console.error("[PUBLICIDAD] notificar admins:", e.message));

      res.status(201).json({ ok: true, data: solicitud });
    } catch (err) { next(err); }
  },

  async misSolicitudes(req, res, next) {
    try {
      const comercio = await comercioDelUsuario(req.usuario.id);
      if (!comercio) return res.json({ ok: true, data: [] });
      const items = await prisma.solicitudPublicidad.findMany({
        where: { comercioId: comercio.id },
        orderBy: { createdAt: "desc" },
        select: selectSolicitud(),
      });
      res.json({ ok: true, data: items });
    } catch (err) { next(err); }
  },

  async iniciarPago(req, res, next) {
    try {
      const id = Number(req.params.id);
      const resultado = await PagoPublicidadService.iniciarCheckout(req.usuario.id, id);
      const solicitud = await prisma.solicitudPublicidad.findUnique({
        where: { id },
        select: selectSolicitud(),
      });
      res.json({
        ok: true,
        data: {
          solicitud,
          pago: {
            estado: resultado.estado,
            proveedor: resultado.proveedor,
            referencia: resultado.referencia,
            checkoutUrl: resultado.checkoutUrl,
          },
        },
      });
    } catch (err) { next(err); }
  },

  async listarAdmin(req, res, next) {
    try {
      const estado = limpiarTexto(req.query.estado, 30);
      const where = estado && ESTADOS.has(estado) ? { estado } : {};
      const items = await prisma.solicitudPublicidad.findMany({
        where,
        orderBy: [{ estado: "asc" }, { createdAt: "desc" }],
        take: 100,
        select: selectSolicitud(),
      });
      res.json({ ok: true, data: items });
    } catch (err) { next(err); }
  },

  async revisarAdmin(req, res, next) {
    try {
      const id = Number(req.params.id);
      const estado = limpiarTexto(req.body.estado, 30).toUpperCase();
      const notasAdmin = limpiarTexto(req.body.notasAdmin, 1200);
      if (!ESTADOS.has(estado) || estado === "PENDIENTE") {
        throw new ErrorValidacion("Estado invalido. Usa APROBADA, RECHAZADA o CONVERTIDA.");
      }
      const existe = await prisma.solicitudPublicidad.findUnique({ where: { id } });
      if (!existe) throw new ErrorNoEncontrado("Solicitud de publicidad no encontrada.");
      if ((estado === "APROBADA" || estado === "CONVERTIDA") && !existe.politicaAceptada) {
        throw new ErrorValidacion("No se puede aprobar una solicitud sin aceptacion de politicas de publicidad.");
      }
      if (estado === "CONVERTIDA" && !PagoPublicidadService.pagoActivable(existe.pagoEstado)) {
        throw new ErrorValidacion("No se puede convertir una pauta sin pago confirmado o cortesia aprobada.");
      }
      if (estado === "APROBADA" || estado === "CONVERTIDA") {
        await asegurarPaquetesPublicidad();
        const paqueteConfig = await prisma.publicidadPaqueteConfig.findUnique({
          where: { codigo: existe.paquete },
          select: selectPaqueteConfig(),
        });
        if (!paqueteConfig?.activo) throw new ErrorValidacion("El paquete de esta solicitud no esta activo.");
        const ventana = ventanaPublicidad({ inicio: existe.inicio || existe.createdAt, fin: existe.fin }, paqueteConfig);
        await validarCupoDisponible(paqueteConfig, ventana, { excluirSolicitudId: existe.id });
      }

      const solicitud = await prisma.solicitudPublicidad.update({
        where: { id },
        data: {
          estado,
          notasAdmin: notasAdmin || null,
          revisadoPor: req.usuario.id,
          revisadoAt: new Date(),
        },
        select: selectSolicitud(),
      });

      await registrarAuditoria({
        tipo: "SOLICITUD_REVISADA",
        entidad: "SolicitudPublicidad",
        entidadId: id,
        usuarioId: req.usuario.id,
        datos: { estadoAnterior: existe.estado, estadoNuevo: estado, notasAdmin: notasAdmin || null },
        ip: limpiarTexto(req.headers["x-forwarded-for"] || req.ip, 120),
      });

      res.json({ ok: true, data: solicitud });
    } catch (err) { next(err); }
  },

  async actualizarPagoAdmin(req, res, next) {
    try {
      const id = Number(req.params.id);
      const estado = limpiarTexto(req.body.estado, 30).toUpperCase();
      const notas = limpiarTexto(req.body.notas, 1200);
      await PagoPublicidadService.actualizarAdmin(req.usuario.id, id, { estado, notas });
      const solicitud = await prisma.solicitudPublicidad.findUnique({
        where: { id },
        select: selectSolicitud(),
      });

      await registrarAuditoria({
        tipo: "PAGO_PUBLICIDAD_ACTUALIZADO",
        entidad: "SolicitudPublicidad",
        entidadId: id,
        usuarioId: req.usuario.id,
        datos: { estadoPago: estado, notas: notas || null },
        ip: limpiarTexto(req.headers["x-forwarded-for"] || req.ip, 120),
      });

      res.json({ ok: true, data: solicitud });
    } catch (err) { next(err); }
  },

  async convertirAdmin(req, res, next) {
    try {
      const id = Number(req.params.id);
      const solicitud = await prisma.solicitudPublicidad.findUnique({
        where: { id },
        include: {
          comercio: { select: { id: true, nombre: true, logoUrl: true, municipio: true } },
          producto: { select: { id: true, nombre: true, fotoUrl: true, activo: true, stock: true } },
        },
      });
      if (!solicitud) throw new ErrorNoEncontrado("Solicitud de publicidad no encontrada.");
      if (solicitud.estado !== "APROBADA") {
        throw new ErrorValidacion("Solo puedes crear pauta desde una solicitud aprobada.");
      }
      if (!PagoPublicidadService.pagoActivable(solicitud.pagoEstado)) {
        throw new ErrorValidacion("La pauta solo puede activarse cuando el pago esta confirmado o fue marcada como cortesia.");
      }

      const { inicio, fin } = fechaInicioFin(solicitud);
      if (!solicitud.politicaAceptada) {
        throw new ErrorValidacion("La solicitud no tiene aceptacion registrada de politicas de publicidad.");
      }
      await asegurarPaquetesPublicidad();
      const paqueteConfig = await prisma.publicidadPaqueteConfig.findUnique({
        where: { codigo: solicitud.paquete },
        select: selectPaqueteConfig(),
      });
      if (!paqueteConfig?.activo) throw new ErrorValidacion("El paquete de esta solicitud no esta activo.");
      await validarCupoDisponible(paqueteConfig, { inicio, fin }, { excluirSolicitudId: solicitud.id });
      const montoCOP = Number(solicitud.presupuestoCOP || 0);
      const notas = [
        `AfroMedia solicitud #${solicitud.id}`,
        solicitud.objetivo ? `Objetivo: ${solicitud.objetivo}` : null,
        solicitud.mensaje ? `Mensaje: ${solicitud.mensaje}` : null,
      ].filter(Boolean).join("\n");

      const campana = await prisma.campanaPublicitaria.create({
        data: {
          comercioId: solicitud.comercioId,
          nombre: tituloCampana(solicitud),
          presupuestoTotal: montoCOP,
          inicio,
          fin,
          notas,
          creadoPor: req.usuario.id,
          estado: 'ACTIVA'
        }
      });

      let destino;

      if (PAQUETES_VISIBILIDAD.has(solicitud.paquete) && solicitud.productoId) {
        if (!solicitud.producto?.activo || solicitud.producto.stock <= 0) {
          throw new ErrorValidacion("El producto ya no esta activo o no tiene stock.");
        }
        const anuncio = await prisma.anuncioUbicacion.create({
          data: {
            campanaId: campana.id,
            modulo: 'PRODUCTOS',
            formato: 'NATIVO',
            productoId: solicitud.productoId,
            alcance: solicitud.alcance || "NACIONAL",
            departamento: solicitud.departamento || null,
            municipio: solicitud.municipio || null,
            etiqueta: "Patrocinado"
          }
        });
        destino = { tipo: "ANUNCIO_UBICACION", id: anuncio.id, subtipo: "PRODUCTOS_NATIVO" };
      } else {
        const esImagenPersonalizada = PAQUETES_IMAGEN_PERSONALIZADA.has(solicitud.paquete);
        if (solicitud.paquete === "VIDEO_HISTORIA") {
          if (!solicitud.videoUrl) {
            throw new ErrorValidacion("Esta solicitud de Video Historia todavia no tiene un video adjunto.");
          }
          if (solicitud.videoAprobado !== true) {
            throw new ErrorValidacion("El video de esta solicitud todavia no paso la revision editorial (revisarVideoAdmin).");
          }
        }
        let imagenUrl;
        if (esImagenPersonalizada) {
          if (!solicitud.imagenPersonalizadaUrl) {
            throw new ErrorValidacion(`El paquete ${solicitud.paquete} requiere que el comercio adjunte primero su imagen diseñada (imagenPersonalizadaUrl).`);
          }
          imagenUrl = solicitud.imagenPersonalizadaUrl;
        } else if (solicitud.paquete === "VIDEO_HISTORIA") {
          imagenUrl = solicitud.videoPortadaUrl || imagenParaCampana(solicitud);
          if (!imagenUrl) {
            throw new ErrorValidacion("Video Historia necesita una portada (videoPortadaUrl) o, en su defecto, foto de producto o logo de comercio.");
          }
        } else {
          imagenUrl = imagenParaCampana(solicitud);
          if (!imagenUrl) {
            throw new ErrorValidacion("Para crear una campana necesitas un producto con foto o un logo de comercio.");
          }
        }

        let modulo = 'VITRINA';
        let formato = 'BANNER';
        
        if (solicitud.paquete === 'BANNER_CARRUSEL') {
           modulo = 'VITRINA'; formato = 'BANNER';
        } else if (solicitud.paquete === 'IRRUPTOR_BIENVENIDA') {
           modulo = 'VITRINA'; formato = 'BANNER';
        } else if (solicitud.paquete === 'VIDEO_HISTORIA') {
           modulo = 'VITRINA'; formato = 'VIDEO';
        } else {
           modulo = 'VITRINA'; formato = 'BANNER';
        }

        const anuncio = await prisma.anuncioUbicacion.create({
          data: {
             campanaId: campana.id,
             modulo,
             formato,
             tipoCampana: solicitud.paquete,
             titulo: tituloCampana(solicitud),
             subtitulo: solicitud.objetivo,
             mediaUrl: solicitud.paquete === "VIDEO_HISTORIA" ? solicitud.videoUrl : imagenUrl,
             ctaTexto: ctaPorPaquete(solicitud.paquete),
             urlDestino: destinoSolicitud(solicitud),
             alcance: solicitud.alcance || "NACIONAL",
             departamento: solicitud.departamento || null,
             municipio: solicitud.municipio || null,
             etiqueta: "Patrocinado"
          }
        });
        destino = { tipo: "ANUNCIO_UBICACION", id: anuncio.id, subtipo: `${modulo}_${formato}` };
      }

      const solicitudActualizada = await prisma.solicitudPublicidad.update({
        where: { id },
        data: {
          estado: "CONVERTIDA",
          notasAdmin: `Pauta creada: ${destino.tipo} #${destino.id}.`,
          revisadoPor: req.usuario.id,
          revisadoAt: new Date(),
        },
        select: selectSolicitud(),
      });

      await registrarAuditoria({
        tipo: "SOLICITUD_CONVERTIDA",
        entidad: "SolicitudPublicidad",
        entidadId: id,
        usuarioId: req.usuario.id,
        datos: { destino, paquete: solicitud.paquete },
        ip: limpiarTexto(req.headers["x-forwarded-for"] || req.ip, 120),
      });

      res.json({ ok: true, data: { solicitud: solicitudActualizada, destino } });
    } catch (err) { next(err); }
  },

  async revisarVideoAdmin(req, res, next) {
    try {
      const id = Number(req.params.id);
      const existe = await prisma.solicitudPublicidad.findUnique({ where: { id } });
      if (!existe) throw new ErrorNoEncontrado("Solicitud de publicidad no encontrada.");
      if (existe.paquete !== "VIDEO_HISTORIA") {
        throw new ErrorValidacion("Solo solicitudes de Video Historia tienen revision editorial de video.");
      }

      const videoAprobado = parseBoolean(req.body.videoAprobado);
      const videoNotasRevision = limpiarTexto(req.body.videoNotasRevision, 1200) || null;
      const data = {
        videoAprobado,
        videoNotasRevision,
        videoRevisadoPor: req.usuario.id,
        videoRevisadoAt: new Date(),
      };
      if (req.body.videoUrl !== undefined) data.videoUrl = limpiarTexto(req.body.videoUrl, 800) || null;
      if (req.body.videoPortadaUrl !== undefined) data.videoPortadaUrl = limpiarTexto(req.body.videoPortadaUrl, 800) || null;
      if (req.body.videoTexto !== undefined) data.videoTexto = limpiarTexto(req.body.videoTexto, 600) || null;
      if (req.body.videoUbicacion !== undefined) data.videoUbicacion = limpiarTexto(req.body.videoUbicacion, 80) || null;
      if (req.body.videoDestino !== undefined) data.videoDestino = limpiarTexto(req.body.videoDestino, 400) || null;

      const solicitud = await prisma.solicitudPublicidad.update({
        where: { id },
        data,
        select: selectSolicitud(),
      });

      await registrarAuditoria({
        tipo: videoAprobado ? "VIDEO_APROBADO" : "VIDEO_RECHAZADO",
        entidad: "SolicitudPublicidad",
        entidadId: id,
        usuarioId: req.usuario.id,
        datos: { videoAprobado, videoNotasRevision },
        ip: limpiarTexto(req.headers["x-forwarded-for"] || req.ip, 120),
      });

      res.json({ ok: true, data: solicitud });
    } catch (err) { next(err); }
  },

  async auditoriaAdmin(req, res, next) {
    try {
      const tipo = limpiarTexto(req.query.tipo, 80) || null;
      const entidad = limpiarTexto(req.query.entidad, 80) || null;
      const { desde, hasta } = rangoFechas(req.query);
      const take = Math.min(Number(req.query.limite || 100), 200);

      const where = {};
      if (tipo) where.tipo = tipo;
      if (entidad) where.entidad = entidad;
      if (desde || hasta) {
        where.createdAt = {};
        if (desde) where.createdAt.gte = desde;
        if (hasta) where.createdAt.lte = hasta;
      }

      const items = await prisma.auditoriaAfroMedia.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          tipo: true,
          entidad: true,
          entidadId: true,
          usuarioId: true,
          datos: true,
          ip: true,
          createdAt: true,
        },
      });

      res.json({ ok: true, data: items });
    } catch (err) { next(err); }
  },

  async tendenciasAdmin(req, res, next) {
    try {
      const { desde, hasta } = rangoFechas(req.query);
      const agrupacion = (req.query.agrupacion || "dia").toLowerCase();
      if (!["dia", "semana"].includes(agrupacion)) {
        throw new ErrorValidacion("agrupacion debe ser 'dia' o 'semana'.");
      }

      const fechaDesde = desde || new Date(Date.now() - 29 * 24 * 3600_000);
      const fechaHasta = hasta || new Date();

      const truncFn = agrupacion === "semana"
        ? `DATE_TRUNC('week', "createdAt" AT TIME ZONE 'America/Bogota')`
        : `DATE_TRUNC('day', "createdAt" AT TIME ZONE 'America/Bogota')`;

      const [eventosRaw, atribucionesRaw, solicitudesRaw] = await Promise.all([
        prisma.$queryRawUnsafe(`
          SELECT ${truncFn}::date AS fecha, "tipoEvento" AS tipo, COUNT(*)::int AS total
          FROM "MetricaPublicitaria"
          WHERE "createdAt" >= $1 AND "createdAt" <= $2
          GROUP BY fecha, "tipoEvento"
          ORDER BY fecha ASC
        `, fechaDesde, fechaHasta),

        prisma.$queryRawUnsafe(`
          SELECT ${truncFn}::date AS fecha,
                 COUNT(*)::int AS pedidos,
                 COALESCE(SUM("valorAtribuido"), 0)::float AS gmv
          FROM "MetricaPublicitaria"
          WHERE "tipoEvento" = 'CONVERSION_COMPRA' 
            AND "createdAt" >= $1 AND "createdAt" <= $2
          GROUP BY fecha
          ORDER BY fecha ASC
        `, fechaDesde, fechaHasta),

        prisma.$queryRawUnsafe(`
          SELECT ${truncFn}::date AS fecha,
                 COUNT(*)::int AS solicitudes,
                 COALESCE(SUM(CASE WHEN "pagoEstado" IN ('PAGADA','CORTESIA') THEN COALESCE("pagoMontoCOP",0) ELSE 0 END), 0)::float AS ingresos
          FROM "SolicitudPublicidad"
          WHERE "createdAt" >= $1 AND "createdAt" <= $2
          GROUP BY fecha
          ORDER BY fecha ASC
        `, fechaDesde, fechaHasta),
      ]);

      // Construir mapa de fechas unificado
      const mapa = new Map();
      const fecha2str = (d) => d instanceof Date ? d.toISOString().slice(0, 10) : String(d);

      for (const row of eventosRaw) {
        const f = fecha2str(row.fecha);
        if (!mapa.has(f)) mapa.set(f, { fecha: f, clics: 0, carritos: 0, pedidos: 0, gmv: 0, solicitudes: 0, ingresos: 0 });
        const entry = mapa.get(f);
        if (row.tipo === "CLIC") entry.clics += Number(row.total || 0);
        if (row.tipo === "CARRITO") entry.carritos += Number(row.total || 0);
      }
      for (const row of atribucionesRaw) {
        const f = fecha2str(row.fecha);
        if (!mapa.has(f)) mapa.set(f, { fecha: f, clics: 0, carritos: 0, pedidos: 0, gmv: 0, solicitudes: 0, ingresos: 0 });
        mapa.get(f).pedidos += Number(row.pedidos || 0);
        mapa.get(f).gmv += Number(row.gmv || 0);
      }
      for (const row of solicitudesRaw) {
        const f = fecha2str(row.fecha);
        if (!mapa.has(f)) mapa.set(f, { fecha: f, clics: 0, carritos: 0, pedidos: 0, gmv: 0, solicitudes: 0, ingresos: 0 });
        mapa.get(f).solicitudes += Number(row.solicitudes || 0);
        mapa.get(f).ingresos += Number(row.ingresos || 0);
      }

      const serie = Array.from(mapa.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));

      res.json({
        ok: true,
        data: {
          agrupacion,
          desde: fechaDesde.toISOString().slice(0, 10),
          hasta: fechaHasta.toISOString().slice(0, 10),
          serie,
        },
      });
    } catch (err) { next(err); }
  },

  async analiticaAdmin(req, res, next) {
    try {
      const { desde, hasta } = rangoFechas(req.query);
      const data = await obtenerDatosAfroMedia({ desde, hasta });
      res.json({
        ok: true,
        data: {
          filtros: {
            desde: desde ? desde.toISOString() : null,
            hasta: hasta ? hasta.toISOString() : null,
          },
          analitica: data.analitica,
        },
      });
    } catch (err) { next(err); }
  },

  async exportarAdmin(req, res, next) {
    try {
      const { desde, hasta } = rangoFechas(req.query);
      const data = await obtenerDatosAfroMedia({ desde, hasta });
      const nombre = `AfroMedia_${req.query.desde || "inicio"}_a_${req.query.hasta || "hoy"}.xlsx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${nombre}"`);
      res.setHeader("Cache-Control", "no-store");

      await registrarAuditoria({
        tipo: "EXPORTACION_EXCEL",
        entidad: "AfroMedia",
        usuarioId: req.usuario?.id || null,
        datos: { desde: req.query.desde || null, hasta: req.query.hasta || null },
        ip: limpiarTexto(req.headers["x-forwarded-for"] || req.ip, 120),
      });

      await generarExcelAfroMedia({
        res,
        filtros: { desde: req.query.desde || null, hasta: req.query.hasta || null },
        paquetes: data.paquetes,
        solicitudes: data.solicitudes,
        visibilidades: data.visibilidades,
        campanas: data.campanas,
        analitica: data.analitica,
      });
    } catch (err) {
      if (res.headersSent) return res.destroy(err);
      next(err);
    }
  },

  async resumenAdmin(req, res, next) {
    try {
      const ahora = new Date();
      const filtroActivaAhora = {
        activa: true,
        campana: { estado: "ACTIVA", inicio: { lte: ahora }, fin: { gte: ahora } },
      };
      const [
        pendientes,
        aprobadas,
        convertidas,
        campanasActivas,
        visibilidadesActivas,
        anunciosVitrinaActivos,
        anunciosProductosActivos,
        pagosPendientesPublicidad,
        pagosConfirmadosPublicidad,
      ] = await Promise.all([
        prisma.solicitudPublicidad.count({ where: { estado: "PENDIENTE" } }),
        prisma.solicitudPublicidad.count({ where: { estado: "APROBADA" } }),
        prisma.solicitudPublicidad.count({ where: { estado: "CONVERTIDA" } }),
        prisma.anuncioUbicacion.count({ where: { modulo: "VITRINA", ...filtroActivaAhora } }),
        prisma.anuncioUbicacion.count({ where: { modulo: "PRODUCTOS", ...filtroActivaAhora } }),
        prisma.anuncioUbicacion.findMany({
          where: { modulo: "VITRINA", ...filtroActivaAhora },
          select: { id: true, campana: { select: { presupuestoTotal: true } } },
        }),
        prisma.anuncioUbicacion.findMany({
          where: { modulo: "PRODUCTOS", ...filtroActivaAhora },
          select: { id: true, campana: { select: { presupuestoTotal: true } } },
        }),
        prisma.solicitudPublicidad.aggregate({
          where: {
            estado: "APROBADA",
            pagoEstado: { in: ["PENDIENTE", "EN_CHECKOUT", "FALLIDA", "VENCIDA"] },
          },
          _count: { _all: true },
          _sum: { pagoMontoCOP: true },
        }),
        prisma.solicitudPublicidad.aggregate({
          where: { pagoEstado: { in: ["PAGADA", "CORTESIA"] } },
          _count: { _all: true },
          _sum: { pagoMontoCOP: true },
        }),
      ]);

      const metricas = await agregarMetricasPorAnuncio([
        ...anunciosVitrinaActivos.map((a) => a.id),
        ...anunciosProductosActivos.map((a) => a.id),
      ]);

      let vistasCampanas = 0, clicsCampanas = 0, inversionVitrina = 0;
      for (const a of anunciosVitrinaActivos) {
        const m = metricas.get(a.id) || { vistas: 0, clics: 0 };
        vistasCampanas += m.vistas;
        clicsCampanas += m.clics;
        inversionVitrina += Number(a.campana?.presupuestoTotal || 0);
      }

      let vistasVisibilidad = 0, clicsVisibilidad = 0, carritosVisibilidad = 0, pedidosAtribuidos = 0, gmvAtribuido = 0, inversionProductos = 0;
      for (const a of anunciosProductosActivos) {
        const m = metricas.get(a.id) || { vistas: 0, clics: 0, carritos: 0, pedidosAtribuidos: 0, gmvAtribuido: 0 };
        vistasVisibilidad += m.vistas;
        clicsVisibilidad += m.clics;
        carritosVisibilidad += m.carritos;
        pedidosAtribuidos += m.pedidosAtribuidos;
        gmvAtribuido += m.gmvAtribuido;
        inversionProductos += Number(a.campana?.presupuestoTotal || 0);
      }
      const unidadesAtribuidas = pedidosAtribuidos;
      const inversionRegistrada = inversionVitrina + inversionProductos;

      res.json({
        ok: true,
        data: {
          solicitudesPendientes: pendientes,
          solicitudesAprobadas: aprobadas,
          solicitudesConvertidas: convertidas,
          campanasActivas,
          visibilidadesActivas,
          vistasCampanas,
          clicsCampanas,
          vistasVisibilidad,
          clicsVisibilidad,
          carritosVisibilidad,
          pedidosAtribuidos,
          unidadesAtribuidas,
          gmvAtribuido,
          inversionRegistrada,
          ctrCampanas: vistasCampanas > 0 ? clicsCampanas / vistasCampanas : 0,
          ctrVisibilidad: vistasVisibilidad > 0 ? clicsVisibilidad / vistasVisibilidad : 0,
          conversionCarrito: clicsVisibilidad > 0 ? carritosVisibilidad / clicsVisibilidad : 0,
          roasVisibilidad: inversionRegistrada > 0 ? gmvAtribuido / inversionRegistrada : 0,
          publicidadPagosPendientes: pagosPendientesPublicidad._count._all,
          publicidadIngresosPendientes: Number(pagosPendientesPublicidad._sum.pagoMontoCOP || 0),
          publicidadPagosConfirmados: pagosConfirmadosPublicidad._count._all,
          publicidadIngresosConfirmados: Number(pagosConfirmadosPublicidad._sum.pagoMontoCOP || 0),
        },
      });
    } catch (err) { next(err); }
  },

  // GET /admin/publicidad/inventario
  async inventarioAdmin(req, res, next) {
    try {
      const slots = await VisibilidadService.obtenerTodosLimites();
      res.json({ ok: true, data: slots });
    } catch (err) { next(err); }
  },

  // PUT /admin/publicidad/inventario/:tipo
  async actualizarInventarioAdmin(req, res, next) {
    try {
      const { tipo } = req.params;
      const { limite } = req.body;
      await VisibilidadService.actualizarLimite(tipo, limite);
      await registrarAuditoria({
        tipo: 'INVENTARIO_ACTUALIZADO',
        entidad: 'VisibilidadInventario',
        usuarioId: req.usuario?.id,
        datos: { tipo, limite: Number(limite) },
        ip: req.ip,
      });
      const slots = await VisibilidadService.obtenerTodosLimites();
      res.json({ ok: true, data: slots });
    } catch (err) { next(err); }
  },

  // GET /api/publicidad/mis-metricas
  async misMetricas(req, res, next) {
    try {
      const comercio = await prisma.comercio.findUnique({ where: { usuarioId: req.usuario.id } });
      if (!comercio) throw new ErrorValidacion("No tienes un comercio asociado.");

      const campanas = await prisma.campanaPublicitaria.findMany({
        where: { comercioId: comercio.id },
        include: {
          anuncios: {
            include: {
              metricas: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const metricasRes = campanas.map(campana => {
        let impresiones = 0;
        let clics = 0;
        let conversiones = 0;
        let gmv = 0;

        campana.anuncios.forEach(anuncio => {
          anuncio.metricas.forEach(m => {
            if (m.tipoEvento === 'IMPRESION') impresiones++;
            else if (m.tipoEvento === 'CLIC') clics++;
            else if (m.tipoEvento === 'CONVERSION_COMPRA') {
              conversiones++;
              gmv += Number(m.valorAtribuido || 0);
            } else if (m.tipoEvento === 'POSTULACION_EMPLEO') {
              conversiones++;
            }
          });
        });

        return {
          id: campana.id,
          nombre: campana.nombre,
          presupuestoTotal: Number(campana.presupuestoTotal || 0),
          estado: campana.estado,
          inicio: campana.inicio,
          fin: campana.fin,
          impresiones,
          clics,
          conversiones,
          gmv,
          ctr: impresiones > 0 ? (clics / impresiones) * 100 : 0
        };
      });

      res.json({ ok: true, data: metricasRes });
    } catch (err) { next(err); }
  },

  async trackMetrica(req, res, next) {
    try {
      const { anuncioId, tipoEvento } = req.body;
      if (!anuncioId || !tipoEvento) {
        return res.status(400).json({ ok: false, mensaje: "Faltan datos" });
      }

      await prisma.metricaPublicitaria.create({
        data: {
          anuncioId: Number(anuncioId),
          tipoEvento,
        }
      });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },

  async convertirSistema(solicitudId) {
    // Busca el primer admin para registrar como creador de la pauta.
    const admin = await prisma.usuario.findFirst({ where: { rol: "ADMIN" } });
    if (!admin) throw new Error("No hay un administrador en el sistema para atribuir la creacion");
    
    // Simula el objeto `req` y `res` para reutilizar `convertirAdmin`
    const req = {
      params: { id: solicitudId },
      usuario: admin,
      headers: { "x-forwarded-for": "127.0.0.1" },
      ip: "127.0.0.1"
    };
    
    return new Promise((resolve, reject) => {
      const res = {
        json: (data) => resolve(data),
        status: () => res,
      };
      const next = (err) => reject(err);
      
      PublicidadController.convertirAdmin(req, res, next);
    });
  },

};

module.exports = PublicidadController;

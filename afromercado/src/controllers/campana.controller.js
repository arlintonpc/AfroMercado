const prisma = require("../config/prisma");

const INCLUDE_ADMIN = { admin: { select: { nombre: true } } };

// Mismo criterio de alcance geográfico que VisibilidadRepository.listarActivas:
// NACIONAL siempre entra; DEPARTAMENTO/MUNICIPIO solo si coincide el departamento del comprador.
function filtroAlcanceGeografico(departamento) {
  return departamento
    ? {
        OR: [
          { alcance: "NACIONAL" },
          { alcance: "DEPARTAMENTO", departamento },
          { alcance: "MUNICIPIO", departamento },
        ],
      }
    : {};
}

// Formatos que solo deben aparecer cuando se piden explícitamente por ?tipo=
// (nunca mezclados en la rotación general del hero, para no saturar) — mismo
// criterio que el sistema anterior (CampanaHero.TIPOS_EXCLUSIVOS).
const TIPOS_EXCLUSIVOS = ["BANNER_CARRUSEL", "IRRUPTOR_BIENVENIDA"];

const CampanaController = {
  /* GET /api/campanas/activas — público, usa el hero. */
  async listarActivas(req, res, next) {
    try {
      const tipo = typeof req.query.tipo === "string" ? req.query.tipo.trim().slice(0, 40) || null : null;
      const departamento = typeof req.query.departamento === "string" ? req.query.departamento.trim().slice(0, 120) || null : null;
      const ahora = new Date();

      let take;
      let formato = "BANNER";
      let modulo = "VITRINA";
      let filtroTipo = {};

      if (tipo === "IRRUPTOR_BIENVENIDA") { take = 1; filtroTipo = { tipoCampana: "IRRUPTOR_BIENVENIDA" }; }
      else if (tipo === "BANNER_CARRUSEL") { take = 4; filtroTipo = { tipoCampana: "BANNER_CARRUSEL" }; }
      else if (tipo === "VIDEO_HISTORIA") { formato = "VIDEO"; }
      else {
        // Sin ?tipo=: rotación general del hero — excluye los formatos
        // exclusivos (o registros viejos sin tipoCampana, que nunca son
        // exclusivos por definición).
        filtroTipo = { OR: [{ tipoCampana: null }, { tipoCampana: { notIn: TIPOS_EXCLUSIVOS } }] };
      }

      const anuncios = await prisma.anuncioUbicacion.findMany({
        where: {
          activa: true,
          campana: {
            estado: "ACTIVA",
            inicio: { lte: ahora },
            fin: { gte: ahora },
          },
          modulo,
          formato,
          ...filtroTipo,
          ...filtroAlcanceGeografico(departamento),
        },
        orderBy: [{ createdAt: "asc" }],
        ...(take ? { take } : {}),
      });

      const campanasMapped = anuncios.map((a) => ({
        id: a.id,
        tipo: a.tipoCampana || (a.formato === "VIDEO" ? "VIDEO_HISTORIA" : "PUBLICIDAD"),
        titulo: a.titulo,
        subtitulo: a.subtitulo,
        imagenUrl: a.formato === "VIDEO" ? null : a.mediaUrl,
        videoUrl: a.formato === "VIDEO" ? a.mediaUrl : null,
        ctaTexto: a.ctaTexto,
        urlDestino: a.urlDestino,
        prioridad: 0,
        etiqueta: a.etiqueta,
      }));

      res.json({ ok: true, items: campanasMapped });
    } catch (err) { next(err); }
  },

  /* GET /api/admin/campanas — admin, lista todas */
  async listarTodas(req, res, next) {
    try {
      const campanas = await prisma.campanaPublicitaria.findMany({
        orderBy: [{ createdAt: "desc" }],
        include: { ...INCLUDE_ADMIN, anuncios: true },
      });
      res.json({ ok: true, items: campanas });
    } catch (err) { next(err); }
  },

  /* POST /api/admin/campanas */
  async crear(req, res, next) {
    try {
      const { tipo = "PUBLICIDAD", titulo, subtitulo, imagenUrl, videoUrl, ctaTexto,
              urlDestino, inicio, fin, montoCOP, notas, prioridad, etiqueta,
              alcance, departamento } = req.body;
      if (!titulo || (!imagenUrl && !videoUrl) || !urlDestino || !inicio || !fin) {
        return res.status(400).json({ error: "titulo, imagenUrl/videoUrl, urlDestino, inicio y fin son requeridos." });
      }

      const alcanceFinal = alcance === "DEPARTAMENTO" ? "DEPARTAMENTO" : "NACIONAL";
      if (alcanceFinal === "DEPARTAMENTO" && !departamento) {
        return res.status(400).json({ error: "departamento es requerido cuando alcance es DEPARTAMENTO." });
      }

      const campana = await prisma.campanaPublicitaria.create({
        data: {
          nombre: titulo,
          presupuestoTotal: montoCOP ? Number(montoCOP) : 0,
          inicio: new Date(inicio),
          fin: new Date(fin),
          notas: notas || null,
          creadoPor: req.usuario.id,
          estado: "ACTIVA",
          anuncios: {
            create: {
              modulo: "VITRINA",
              formato: videoUrl ? "VIDEO" : "BANNER",
              tipoCampana: tipo,
              titulo,
              subtitulo: subtitulo || null,
              mediaUrl: videoUrl || imagenUrl,
              urlDestino,
              ctaTexto: ctaTexto || "Ver más",
              alcance: alcanceFinal,
              departamento: alcanceFinal === "DEPARTAMENTO" ? departamento : null,
              etiqueta: etiqueta || "Patrocinado",
            }
          }
        },
        include: { anuncios: true }
      });
      res.status(201).json({ ok: true, campana });
    } catch (err) { next(err); }
  },

  /* PATCH /api/admin/campanas/:id/desactivar */
  async desactivar(req, res, next) {
    try {
      const campana = await prisma.campanaPublicitaria.update({
        where: { id: Number(req.params.id) },
        data: { estado: "FINALIZADA" }, // ACTIVA -> FINALIZADA / PAUSADA
      });
      res.json({ ok: true, campana });
    } catch (err) { next(err); }
  },

  /* PATCH /api/admin/campanas/:id/activar */
  async activar(req, res, next) {
    try {
      const campana = await prisma.campanaPublicitaria.update({
        where: { id: Number(req.params.id) },
        data: { estado: "ACTIVA" },
      });
      res.json({ ok: true, campana });
    } catch (err) { next(err); }
  },

  /* POST /api/campanas/:id/vista — público, fire-and-forget */
  async registrarVista(req, res, next) {
    try {
      await prisma.metricaPublicitaria.create({
        data: {
          anuncioId: Number(req.params.id),
          tipoEvento: "IMPRESION",
          usuarioId: req.usuario ? req.usuario.id : null,
        }
      });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  /* POST /api/campanas/:id/clic — público, fire-and-forget */
  async registrarClic(req, res, next) {
    try {
      await prisma.metricaPublicitaria.create({
        data: {
          anuncioId: Number(req.params.id),
          tipoEvento: "CLIC",
          usuarioId: req.usuario ? req.usuario.id : null,
        }
      });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = CampanaController;

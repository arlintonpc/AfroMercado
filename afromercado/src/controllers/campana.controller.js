const prisma = require("../config/prisma");

const INCLUDE_ADMIN = { admin: { select: { nombre: true } } };

// Formatos que solo deben aparecer cuando se piden explícitamente por ?tipo=
// (nunca mezclados en la rotación general del hero, para no saturar).
const TIPOS_EXCLUSIVOS = ["BANNER_CARRUSEL", "IRRUPTOR_BIENVENIDA"];

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

const CampanaController = {
  /* GET /api/campanas/activas — público, usa el hero.
     Sin ?tipo=, mantiene el comportamiento de siempre (mezcla PUBLICIDAD/SOCIAL,
     excluye BANNER_CARRUSEL/IRRUPTOR_BIENVENIDA para no duplicarlos con sus propios
     componentes). Con ?tipo=, filtra a ese tipo exacto y aplica el cupo correspondiente. */
  async listarActivas(req, res, next) {
    try {
      const tipo = typeof req.query.tipo === "string" ? req.query.tipo.trim().slice(0, 40) || null : null;
      const departamento = typeof req.query.departamento === "string" ? req.query.departamento.trim().slice(0, 120) || null : null;
      const ahora = new Date();

      let take;
      if (tipo === "IRRUPTOR_BIENVENIDA") take = 1;
      else if (tipo === "BANNER_CARRUSEL") take = 4;

      const campanas = await prisma.campanaHero.findMany({
        where: {
          activa: true,
          inicio: { lte: ahora },
          fin: { gte: ahora },
          ...(tipo ? { tipo } : { tipo: { notIn: TIPOS_EXCLUSIVOS } }),
          ...filtroAlcanceGeografico(departamento),
        },
        orderBy: [{ prioridad: "desc" }, { createdAt: "asc" }],
        ...(take ? { take } : {}),
        select: {
          id: true, tipo: true, titulo: true, subtitulo: true, imagenUrl: true, videoUrl: true,
          ctaTexto: true, urlDestino: true, prioridad: true, etiqueta: true,
        },
      });
      res.json({ ok: true, items: campanas });
    } catch (err) { next(err); }
  },

  /* GET /api/admin/campanas — admin, lista todas */
  async listarTodas(req, res, next) {
    try {
      const campanas = await prisma.campanaHero.findMany({
        orderBy: [{ activa: "desc" }, { inicio: "desc" }],
        include: INCLUDE_ADMIN,
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
      if (!titulo || !imagenUrl || !urlDestino || !inicio || !fin) {
        return res.status(400).json({ error: "titulo, imagenUrl, urlDestino, inicio y fin son requeridos." });
      }
      const TIPOS_PERMITIDOS = ["PUBLICIDAD", "SOCIAL", "IRRUPTOR_BIENVENIDA"];
      const tipoFinal = TIPOS_PERMITIDOS.includes(tipo) ? tipo : "PUBLICIDAD";
      const ctaDefault = tipoFinal === "SOCIAL" ? "Conoce más" : "Ver más";
      const etiquetaDefault = tipoFinal === "SOCIAL" ? "Comunidad" : "Patrocinado";

      const alcanceFinal = alcance === "DEPARTAMENTO" ? "DEPARTAMENTO" : "NACIONAL";
      if (alcanceFinal === "DEPARTAMENTO" && !departamento) {
        return res.status(400).json({ error: "departamento es requerido cuando alcance es DEPARTAMENTO." });
      }

      const campana = await prisma.campanaHero.create({
        data: {
          tipo: tipoFinal,
          titulo, subtitulo: subtitulo || null,
          imagenUrl, videoUrl: videoUrl || null,
          ctaTexto: ctaTexto || ctaDefault,
          urlDestino, inicio: new Date(inicio), fin: new Date(fin),
          montoCOP: tipoFinal === "SOCIAL" ? null : (montoCOP ? Number(montoCOP) : null),
          notas: notas || null, prioridad: Number(prioridad ?? (tipoFinal === "SOCIAL" ? 8 : 0)),
          etiqueta: etiqueta || etiquetaDefault,
          alcance: alcanceFinal,
          departamento: alcanceFinal === "DEPARTAMENTO" ? departamento : null,
          creadoPor: req.usuario.id,
        },
      });
      res.status(201).json({ ok: true, campana });
    } catch (err) { next(err); }
  },

  /* PATCH /api/admin/campanas/:id/desactivar */
  async desactivar(req, res, next) {
    try {
      const campana = await prisma.campanaHero.update({
        where: { id: Number(req.params.id) },
        data: { activa: false },
      });
      res.json({ ok: true, campana });
    } catch (err) { next(err); }
  },

  /* POST /api/campanas/:id/vista — público, fire-and-forget */
  async registrarVista(req, res, next) {
    try {
      await prisma.campanaHero.updateMany({
        where: { id: Number(req.params.id), activa: true },
        data: { vistas: { increment: 1 } },
      });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  /* POST /api/campanas/:id/clic — público, fire-and-forget */
  async registrarClic(req, res, next) {
    try {
      await prisma.campanaHero.updateMany({
        where: { id: Number(req.params.id), activa: true },
        data: { clics: { increment: 1 } },
      });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};

module.exports = CampanaController;

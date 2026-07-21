const prisma = require("../config/prisma");
const VisibilidadRepository = require("../repositories/visibilidad.repository");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");

const TIPOS_VALIDOS = ["CATALOGO", "HOME_DESTACADO"];

const LIMITES_DEFAULT = {
  HOME_DESTACADO: 3,
  CATALOGO: 10,
};

const CLAVE_CONFIG = {
  HOME_DESTACADO: "inventario_max_home_destacado",
  CATALOGO: "inventario_max_catalogo",
};

async function obtenerLimite(tipo) {
  const clave = CLAVE_CONFIG[tipo];
  if (!clave) return LIMITES_DEFAULT[tipo] ?? 10;
  try {
    const cfg = await prisma.config.findUnique({ where: { clave } });
    if (cfg) {
      const n = Number(cfg.valor);
      if (Number.isInteger(n) && n > 0) return n;
    }
  } catch { /* usa default */ }
  return LIMITES_DEFAULT[tipo] ?? 10;
}

async function contarActivasPorTipo(tipo) {
  const ahora = new Date();
  return prisma.anuncioUbicacion.count({
    where: { 
      activa: true,
      modulo: "PRODUCTOS", 
      etiqueta: tipo === "HOME_DESTACADO" ? "HOME_DESTACADO" : "CATALOGO",
      campana: {
        estado: "ACTIVA", 
        inicio: { lte: ahora }, 
        fin: { gt: ahora }
      }
    },
  });
}

const VisibilidadService = {
  LIMITES_DEFAULT,
  CLAVE_CONFIG,

  obtenerLimite,

  async obtenerTodosLimites() {
    const tipos = Object.keys(LIMITES_DEFAULT);
    return Promise.all(tipos.map(async (tipo) => {
      const [limite, activos] = await Promise.all([
        obtenerLimite(tipo),
        contarActivasPorTipo(tipo),
      ]);
      return { tipo, limite, activos, disponibles: Math.max(0, limite - activos), lleno: activos >= limite };
    }));
  },

  async actualizarLimite(tipo, valor) {
    if (!CLAVE_CONFIG[tipo]) throw new ErrorValidacion(`Tipo no soportado: ${tipo}`);
    const n = Number(valor);
    if (!Number.isInteger(n) || n < 0) throw new ErrorValidacion("El limite debe ser un entero positivo.");
    const clave = CLAVE_CONFIG[tipo];
    return prisma.config.upsert({
      where: { clave },
      update: { valor: String(n) },
      create: { clave, valor: String(n) },
    });
  },

  async crear({ comercioId, productoId, tipo, inicio, fin, montoCOP, notas, etiqueta, adminId }) {
    if (!TIPOS_VALIDOS.includes(tipo)) {
      throw new ErrorValidacion(`Tipo inválido. Usa: ${TIPOS_VALIDOS.join(", ")}`);
    }
    if (!comercioId) throw new ErrorValidacion("comercioId es requerido");
    if (!inicio || !fin) throw new ErrorValidacion("inicio y fin son requeridos");
    if (new Date(fin) <= new Date(inicio)) {
      throw new ErrorValidacion("fin debe ser posterior a inicio");
    }

    const [limite, activos] = await Promise.all([
      obtenerLimite(tipo),
      contarActivasPorTipo(tipo),
    ]);
    if (activos >= limite) {
      throw new ErrorValidacion(
        `La sección ${tipo === "HOME_DESTACADO" ? "Home Destacado" : "Catálogo"} ya tiene el máximo de slots activos (${activos}/${limite}). Desactiva uno antes de crear otro.`,
      );
    }

    return VisibilidadRepository.crear({ comercioId, productoId, tipo, inicio, fin, montoCOP, notas, etiqueta, adminId });
  },

  async listarActivas(tipo, departamento = null) {
    const items = await VisibilidadRepository.listarActivas(tipo, departamento);
    if (!tipo) {
      // Sin filtro: cortar cada tipo a su límite
      const limites = await Promise.all(
        TIPOS_VALIDOS.map(async (t) => [t, await obtenerLimite(t)])
      );
      const limiteMap = Object.fromEntries(limites);
      const contadores = {};
      return items.filter((item) => {
        const t = item.tipo;
        contadores[t] = (contadores[t] || 0) + 1;
        return contadores[t] <= (limiteMap[t] ?? 999);
      });
    }
    const limite = await obtenerLimite(tipo);
    return items.slice(0, limite);
  },

  async listarTodas(opts) {
    return VisibilidadRepository.listarTodas(opts);
  },

  async desactivar(id) {
    const vis = await VisibilidadRepository.buscarPorId(id);
    if (!vis) throw new ErrorNoEncontrado("Visibilidad no encontrada");
    return VisibilidadRepository.desactivar(id);
  },
};

module.exports = VisibilidadService;

const prisma = require("../config/prisma");
const Reglas = require("../config/reglas");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");

const EnvioController = {
  async calcular(req, res, next) {
    try {
      const { departamento, pesoKg } = req.query;
      if (!departamento || !pesoKg) {
        throw new ErrorValidacion("Se requieren departamento y pesoKg");
      }
      const peso = parseFloat(pesoKg);
      if (isNaN(peso) || peso <= 0) {
        throw new ErrorValidacion("pesoKg debe ser un número positivo");
      }

      let tarifa = await prisma.tarifaEnvio.findFirst({
        where: {
          departamento: { equals: departamento, mode: "insensitive" },
          pesoMaxKg: { gte: peso },
          activa: true,
        },
        orderBy: { pesoMaxKg: "asc" },
      });

      if (!tarifa) {
        tarifa = await prisma.tarifaEnvio.findFirst({
          where: {
            departamento: "Nacional",
            pesoMaxKg: { gte: peso },
            activa: true,
          },
          orderBy: { pesoMaxKg: "asc" },
        });
      }

      if (!tarifa) {
        throw new ErrorNoEncontrado(
          "No hay tarifa de envío disponible para este peso y destino"
        );
      }

      // ── Envío gratis (híbrido, configurable) ─────────────────
      // Si el front envía el subtotal (y el comercio, en pedidos de una sola
      // tienda), aplicamos las mismas reglas que el checkout para que lo que se
      // muestra coincida con lo que se cobra. El estimador del producto no envía
      // subtotal, así que ahí siempre se ve la tarifa base.
      let precio = Number(tarifa.precio);
      let gratis = false;
      let motivo = null;
      const subtotal = req.query.subtotal != null ? Number(req.query.subtotal) : null;
      const comercioId = req.query.comercioId != null ? Number(req.query.comercioId) : null;

      if (subtotal != null && Number.isFinite(subtotal) && subtotal > 0) {
        const umbralPlataforma = await Reglas.numero("envio_gratis_umbral_plataforma");
        if (umbralPlataforma > 0 && subtotal >= umbralPlataforma) {
          precio = 0; gratis = true; motivo = "plataforma";
        }
        if (!gratis && comercioId) {
          const vendedorPermitido = await Reglas.bool("envio_gratis_vendedor_permitido");
          if (vendedorPermitido) {
            const cfg = await prisma.config.findUnique({
              where: { clave: `envio_gratis_comercio:${comercioId}` },
            });
            const umbral = cfg && cfg.valor ? Number(cfg.valor) : null;
            if (umbral !== null && umbral > 0 && subtotal >= umbral) {
              precio = 0; gratis = true; motivo = "vendedor";
            }
          }
        }
      }

      res.json({
        ok: true,
        data: {
          precio,
          gratis,
          motivo,
          departamento: tarifa.departamento,
          pesoKg: peso,
          tarifa: {
            id: tarifa.id,
            pesoMaxKg: Number(tarifa.pesoMaxKg),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async listarTarifas(req, res, next) {
    try {
      const tarifas = await prisma.tarifaEnvio.findMany({
        where: { activa: true },
        orderBy: [{ departamento: "asc" }, { pesoMaxKg: "asc" }],
      });

      const agrupadas = tarifas.reduce((acc, t) => {
        const dep = t.departamento;
        if (!acc[dep]) acc[dep] = [];
        acc[dep].push({
          id: t.id,
          departamento: t.departamento,
          pesoMaxKg: Number(t.pesoMaxKg),
          precio: Number(t.precio),
          activa: t.activa,
        });
        return acc;
      }, {});

      res.json({ ok: true, data: agrupadas });
    } catch (err) {
      next(err);
    }
  },

  async upsertTarifa(req, res, next) {
    try {
      const { departamento, pesoMaxKg, precio } = req.body;
      if (!departamento || pesoMaxKg == null || precio == null) {
        throw new ErrorValidacion("Se requieren departamento, pesoMaxKg y precio");
      }
      const tarifa = await prisma.tarifaEnvio.upsert({
        where: {
          departamento_pesoMaxKg: {
            departamento,
            pesoMaxKg: parseFloat(pesoMaxKg),
          },
        },
        update: { precio: parseFloat(precio), activa: true },
        create: {
          departamento,
          pesoMaxKg: parseFloat(pesoMaxKg),
          precio: parseFloat(precio),
        },
      });

      res.json({
        ok: true,
        data: {
          id: tarifa.id,
          departamento: tarifa.departamento,
          pesoMaxKg: Number(tarifa.pesoMaxKg),
          precio: Number(tarifa.precio),
          activa: tarifa.activa,
        },
      });
    } catch (err) {
      next(err);
    }
  },
  async desactivarTarifa(req, res, next) {
    try {
      const tarifa = await prisma.tarifaEnvio.update({
        where: { id: Number(req.params.id) },
        data: { activa: false },
      });
      res.json({ ok: true, data: { id: tarifa.id, activa: tarifa.activa } });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = EnvioController;

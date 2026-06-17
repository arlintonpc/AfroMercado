const CuponRepository = require("../repositories/cupon.repository");
const { ErrorValidacion } = require("../utils/errores");

const CuponController = {
  async validar(req, res, next) {
    try {
      const { codigo, subtotal } = req.body;
      if (!codigo || typeof codigo !== "string" || !codigo.trim()) {
        throw new ErrorValidacion("El código de cupón es obligatorio");
      }
      if (subtotal === undefined || isNaN(Number(subtotal)) || Number(subtotal) <= 0) {
        throw new ErrorValidacion("El subtotal debe ser un número positivo");
      }
      const resultado = await CuponRepository.validarParaUsuario(
        codigo.trim().toUpperCase(),
        req.usuario.id,
        Number(subtotal)
      );
      if (resultado.error) {
        throw new ErrorValidacion(resultado.error);
      }
      res.json({ ok: true, data: resultado });
    } catch (err) {
      next(err);
    }
  },

  async crear(req, res, next) {
    try {
      const { codigo, tipo, valor, minimoCompra, usosMaximos, inicio, fin, soloNuevos } = req.body;
      if (!codigo || !tipo || valor === undefined || !inicio || !fin) {
        throw new ErrorValidacion("Faltan campos obligatorios: codigo, tipo, valor, inicio, fin");
      }
      if (!["PORCENTAJE", "VALOR_FIJO"].includes(tipo)) {
        throw new ErrorValidacion("El tipo debe ser PORCENTAJE o VALOR_FIJO");
      }
      const cupon = await CuponRepository.crearAdmin({
        codigo: codigo.trim().toUpperCase(),
        tipo,
        valor: Number(valor),
        minimoCompra: minimoCompra !== undefined ? Number(minimoCompra) : null,
        usosMaximos: usosMaximos !== undefined ? Number(usosMaximos) : null,
        inicio: new Date(inicio),
        fin: new Date(fin),
        soloNuevos: soloNuevos ?? false,
      });
      res.status(201).json({ ok: true, data: cupon });
    } catch (err) {
      next(err);
    }
  },

  async listar(req, res, next) {
    try {
      const pagina = req.query.pagina ? parseInt(req.query.pagina) : 1;
      const porPagina = req.query.porPagina ? parseInt(req.query.porPagina) : 20;
      const resultado = await CuponRepository.listarAdmin({ pagina, porPagina });
      res.json({ ok: true, data: resultado });
    } catch (err) {
      next(err);
    }
  },

  async desactivar(req, res, next) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ErrorValidacion("ID de cupón inválido");
      const cupon = await CuponRepository.desactivar(id);
      res.json({ ok: true, data: cupon });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = CuponController;

// ============================================================
//  Servicio de Carrito — lógica de negocio
//
//  Toda operación (obtener / agregar / actualizar / eliminar / vaciar)
//  devuelve el carrito COMPLETO ya normalizado para el frontend:
//    { items: [{ productoId, cantidad, precioAlAgregar, alertaPrecio,
//                producto: { id, nombre, precio(number), unidad, stock,
//                            fotoUrl, dias..., alcance, comercio } }],
//      cantidadTotal, subtotal }
// ============================================================
const CarritoRepository = require("../repositories/carrito.repository");
const ProductoRepository = require("../repositories/producto.repository");
const { ErrorValidacion, ErrorNoEncontrado } = require("../utils/errores");
const { ofertaTieneCupo, ofertaVigente, precioVigente } = require("../utils/ofertas");

function validarCupoOferta(producto, cantidad) {
  const oferta = ofertaVigente(producto, new Date(), 1);
  if (!oferta || ofertaTieneCupo(oferta, cantidad)) return;
  const restantes = Math.max(0, Number(oferta.stockLimite) - Number(oferta.stockUsado));
  throw new ErrorValidacion(
    `La oferta de "${producto.nombre}" solo tiene ${restantes} unidad(es) disponibles.`
  );
}

/** Normaliza un CarritoItem de Prisma a la forma que consume la UI. */
function mapearItem(item) {
  const p = item.producto;
  const precio = Number(p.precio);
  const precioInfo = precioVigente(p);
  const precioAlAgregar = Number(item.precioAlAgregar);
  const c = p.comercio;
  const oferta = precioInfo.oferta
    ? {
        id: precioInfo.oferta.id,
        tipo: precioInfo.oferta.tipo,
        valor: Number(precioInfo.oferta.valor),
        etiqueta: precioInfo.oferta.etiqueta || undefined,
        precioFinal: precioInfo.precioFinal,
        fin: precioInfo.oferta.fin,
        stockLimite: precioInfo.oferta.stockLimite,
        stockUsado: precioInfo.oferta.stockUsado,
      }
    : undefined;
  return {
    productoId: String(p.id),
    cantidad: item.cantidad,
    precioAlAgregar,
    alertaPrecio: precioInfo.precioFinal !== precioAlAgregar,
    producto: {
      id: String(p.id),
      nombre: p.nombre,
      precio,
      unidad: p.unidad,
      stock: p.stock,
      stockReservado: p.stockReservado,
      fotoUrl: p.fotoUrl ?? undefined,
      diasAlistamientoMin: p.diasAlistamientoMin,
      diasAlistamientoMax: p.diasAlistamientoMax,
      alcance: p.alcance,
      oferta,
      comercio: c
        ? {
            nombre: c.nombre,
            municipio: c.municipio,
            verificado: c.verificado,
            totalVentas: c.totalVentas,
            calificacion: Number(c.calificacion),
            ivaActivo: c.configFiscal?.ivaActivo ?? false,
            ivaPorcentaje: c.configFiscal ? Number(c.configFiscal.ivaPorcentaje) : 0,
          }
        : undefined,
    },
  };
}

/** Construye el carrito completo del usuario con totales. */
async function construirCarrito(usuarioId) {
  const crudos = await CarritoRepository.obtenerCarrito(usuarioId);
  const items = crudos.map(mapearItem);
  const cantidadTotal = items.reduce((acc, i) => acc + i.cantidad, 0);
  const subtotal = items.reduce(
    (acc, i) => acc + (i.producto.oferta?.precioFinal ?? i.producto.precio) * i.cantidad,
    0
  );
  return { items, cantidadTotal, subtotal };
}

const CarritoService = {
  async obtener(usuarioId) {
    return construirCarrito(usuarioId);
  },

  async agregar(usuarioId, productoId, cantidad) {
    const pid = Number(productoId);
    if (!pid) throw new ErrorValidacion("productoId es requerido");
    if (!cantidad || cantidad < 1)
      throw new ErrorValidacion("La cantidad debe ser mayor a cero");

    const producto = await ProductoRepository.buscarPublicoPorId(pid);
    if (!producto || !producto.activo || producto.deletedAt) {
      throw new ErrorNoEncontrado("Producto no encontrado o inactivo");
    }

    const stockDisponible = producto.stock - producto.stockReservado;
    if (stockDisponible < cantidad) {
      throw new ErrorValidacion(`Stock insuficiente. Disponible: ${stockDisponible}`);
    }

    validarCupoOferta(producto, cantidad);
    const precioInfo = precioVigente(producto, new Date(), cantidad);
    if (precioInfo.oferta && precioInfo.precioFinal <= 0) {
      throw new ErrorValidacion("La oferta vigente no tiene un precio válido.");
    }

    await CarritoRepository.agregarItem(usuarioId, pid, cantidad, precioInfo.precioFinal);
    return construirCarrito(usuarioId);
  },

  async actualizarCantidad(usuarioId, productoId, cantidad) {
    const pid = Number(productoId);
    if (!pid) throw new ErrorValidacion("productoId es requerido");
    if (!cantidad || cantidad < 1)
      throw new ErrorValidacion("La cantidad debe ser mayor a cero");

    const producto = await ProductoRepository.buscarPublicoPorId(pid);
    if (!producto || !producto.activo) {
      throw new ErrorNoEncontrado("Producto no encontrado o inactivo");
    }

    const stockDisponible = producto.stock - producto.stockReservado;
    if (stockDisponible < cantidad) {
      throw new ErrorValidacion(`Stock insuficiente. Disponible: ${stockDisponible}`);
    }
    validarCupoOferta(producto, cantidad);
    const precioInfo = precioVigente(producto, new Date(), cantidad);
    if (precioInfo.oferta && precioInfo.precioFinal <= 0) {
      throw new ErrorValidacion("La oferta vigente no tiene un precio válido.");
    }

    await CarritoRepository.actualizarCantidad(usuarioId, pid, cantidad, precioInfo.precioFinal);
    return construirCarrito(usuarioId);
  },

  async eliminar(usuarioId, productoId) {
    await CarritoRepository.eliminarItem(usuarioId, Number(productoId));
    return construirCarrito(usuarioId);
  },

  async vaciar(usuarioId) {
    await CarritoRepository.vaciarCarrito(usuarioId);
    return construirCarrito(usuarioId);
  },
};

module.exports = CarritoService;

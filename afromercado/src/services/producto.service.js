// Lógica de negocio — Productos
const ProductoRepository = require("../repositories/producto.repository");
const ComercioRepository = require("../repositories/comercio.repository");
const { ErrorValidacion, ErrorNoEncontrado, ErrorNoAutorizado } = require("../utils/errores");

const UNIDADES_VALIDAS = ["KG", "UNIDAD", "LITRO", "PAQUETE", "DOCENA", "MANOJO"];
const ALCANCES_VALIDOS = ["LOCAL", "NACIONAL", "AMBOS"];

const ProductoService = {
  async crear(usuarioId, datos) {
    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    if (!comercio) throw new ErrorValidacion("Debes tener un comercio registrado para publicar productos");

    const { nombre, descripcion, precio, unidad, stock, diasAlistamientoMin, diasAlistamientoMax, alcance, fotoUrl } = datos;

    if (!nombre || !precio || !unidad) {
      throw new ErrorValidacion("Nombre, precio y unidad son obligatorios");
    }
    if (!UNIDADES_VALIDAS.includes(unidad)) {
      throw new ErrorValidacion(`Unidad inválida. Opciones: ${UNIDADES_VALIDAS.join(", ")}`);
    }
    if (alcance && !ALCANCES_VALIDOS.includes(alcance)) {
      throw new ErrorValidacion(`Alcance inválido. Opciones: ${ALCANCES_VALIDOS.join(", ")}`);
    }
    if (parseFloat(precio) <= 0) {
      throw new ErrorValidacion("El precio debe ser mayor a cero");
    }
    const min = parseInt(diasAlistamientoMin ?? 1);
    const max = parseInt(diasAlistamientoMax ?? 3);
    if (min < 0 || max < min) {
      throw new ErrorValidacion("Los días de alistamiento deben ser positivos y el máximo >= al mínimo");
    }

    return ProductoRepository.crear({
      comercioId: comercio.id,
      nombre: nombre.trim(),
      descripcion: descripcion?.trim(),
      precio: parseFloat(precio),
      unidad,
      stock: parseInt(stock ?? 0),
      diasAlistamientoMin: min,
      diasAlistamientoMax: max,
      alcance: alcance ?? "LOCAL",
      fotoUrl,
    });
  },

  async listar(filtros) {
    return ProductoRepository.listar(filtros);
  },

  async obtenerPorId(id) {
    const producto = await ProductoRepository.buscarPorId(id);
    if (!producto || !producto.activo) throw new ErrorNoEncontrado("Producto no encontrado");
    return producto;
  },

  async misProductos(usuarioId) {
    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    if (!comercio) throw new ErrorValidacion("No tienes un comercio registrado");
    return ProductoRepository.listarPorComercio(comercio.id);
  },

  async actualizar(usuarioId, productoId, datos) {
    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    if (!comercio) throw new ErrorNoAutorizado("No tienes permiso para editar este producto");

    const producto = await ProductoRepository.buscarPorId(productoId);
    if (!producto) throw new ErrorNoEncontrado("Producto no encontrado");
    if (producto.comercioId !== comercio.id) throw new ErrorNoAutorizado("No puedes editar productos de otro comerciante");

    const campos = {};
    if (datos.nombre) campos.nombre = datos.nombre.trim();
    if (datos.descripcion !== undefined) campos.descripcion = datos.descripcion?.trim();
    if (datos.precio) {
      if (parseFloat(datos.precio) <= 0) throw new ErrorValidacion("El precio debe ser mayor a cero");
      campos.precio = parseFloat(datos.precio);
    }
    if (datos.stock !== undefined) campos.stock = parseInt(datos.stock);
    if (datos.fotoUrl !== undefined) campos.fotoUrl = datos.fotoUrl;
    if (datos.alcance) {
      if (!ALCANCES_VALIDOS.includes(datos.alcance)) throw new ErrorValidacion("Alcance inválido");
      campos.alcance = datos.alcance;
    }
    if (datos.activo !== undefined) campos.activo = Boolean(datos.activo);

    return ProductoRepository.actualizar(productoId, campos);
  },

  async desactivar(usuarioId, productoId) {
    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    if (!comercio) throw new ErrorNoAutorizado("Sin permiso");

    const producto = await ProductoRepository.buscarPorId(productoId);
    if (!producto) throw new ErrorNoEncontrado("Producto no encontrado");
    if (producto.comercioId !== comercio.id) throw new ErrorNoAutorizado("No puedes eliminar productos de otro comerciante");

    return ProductoRepository.desactivar(productoId);
  },

  // ── Imágenes del producto ────────────────────────────────────
  // Verifica que el producto exista y pertenezca al comerciante.
  async _verificarPropiedad(usuarioId, productoId) {
    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    if (!comercio) throw new ErrorNoAutorizado("No tienes un comercio registrado");
    const producto = await ProductoRepository.buscarPorId(productoId);
    if (!producto) throw new ErrorNoEncontrado("Producto no encontrado");
    if (producto.comercioId !== comercio.id)
      throw new ErrorNoAutorizado("No puedes editar productos de otro comerciante");
    return producto;
  },

  // Agrega imágenes (URLs). La primera se vuelve principal si aún no hay.
  async agregarImagenes(usuarioId, productoId, urls) {
    const producto = await this._verificarPropiedad(usuarioId, productoId);
    if (!Array.isArray(urls) || urls.length === 0)
      throw new ErrorValidacion("No se recibieron imágenes");
    const imagenes = [...(producto.imagenes || []), ...urls];
    const fotoUrl = producto.fotoUrl || urls[0];
    return ProductoRepository.actualizar(productoId, { imagenes, fotoUrl });
  },

  // Quita una imagen. Si era la principal, asigna otra (o ninguna).
  async quitarImagen(usuarioId, productoId, url) {
    const producto = await this._verificarPropiedad(usuarioId, productoId);
    if (!url) throw new ErrorValidacion("Falta la url de la imagen a quitar");
    const imagenes = (producto.imagenes || []).filter((u) => u !== url);
    const fotoUrl =
      producto.fotoUrl === url ? imagenes[0] || null : producto.fotoUrl;
    return ProductoRepository.actualizar(productoId, { imagenes, fotoUrl });
  },

  // Marca una imagen existente como principal (fotoUrl).
  async establecerPrincipal(usuarioId, productoId, url) {
    const producto = await this._verificarPropiedad(usuarioId, productoId);
    const todas = [producto.fotoUrl, ...(producto.imagenes || [])].filter(Boolean);
    if (!todas.includes(url))
      throw new ErrorValidacion("Esa imagen no pertenece al producto");
    return ProductoRepository.actualizar(productoId, { fotoUrl: url });
  },
};

module.exports = ProductoService;

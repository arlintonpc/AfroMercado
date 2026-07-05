// Lógica de negocio — Productos
const ProductoRepository = require("../repositories/producto.repository");
const ComercioRepository = require("../repositories/comercio.repository");
const { ErrorValidacion, ErrorNoEncontrado, ErrorNoAutorizado } = require("../utils/errores");
const { eliminarDeCloudinary } = require("../utils/cloudinary");
const { eliminarArchivoLocalDesdeUrl } = require("../utils/video-media");
const { assertPuedePublicar } = require("../utils/comercio-publicacion");

const UNIDADES_VALIDAS = ["KG", "UNIDAD", "LITRO", "PAQUETE", "DOCENA", "MANOJO"];
const ALCANCES_VALIDOS = ["LOCAL", "NACIONAL", "AMBOS"];

async function limpiarVideoAnterior(producto) {
  if (!producto) return;
  if (producto.videoPublicId) {
    await eliminarDeCloudinary(producto.videoPublicId, "video").catch(e => console.error('[Cloudinary]', e?.message ?? e));
    return;
  }
  if (producto.videoUrl) {
    eliminarArchivoLocalDesdeUrl(producto.videoUrl);
  }
}

const ProductoService = {
  async crear(usuarioId, datos) {
    const comercio = await ComercioRepository.buscarPorUsuarioIdConCuenta(usuarioId);
    if (!comercio) throw new ErrorValidacion("Debes tener un comercio registrado para publicar productos");
    assertPuedePublicar(comercio);

    const { nombre, descripcion, precio, unidad, stock, stockMinimo, diasAlistamientoMin, diasAlistamientoMax, alcance, fotoUrl, categoriaId, pesoKg, esExpress, tiempoEntregaMin } = datos;

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
    if (pesoKg !== undefined && pesoKg !== null && parseFloat(pesoKg) <= 0) {
      throw new ErrorValidacion("El peso debe ser mayor a cero");
    }

    return ProductoRepository.crear({
      comercioId: comercio.id,
      nombre: nombre.trim(),
      descripcion: descripcion?.trim(),
      precio: parseFloat(precio),
      unidad,
      stock: parseInt(stock ?? 0),
      stockMinimo: parseInt(stockMinimo ?? 0),
      diasAlistamientoMin: min,
      diasAlistamientoMax: max,
      alcance: alcance ?? "LOCAL",
      fotoUrl,
      ...(categoriaId ? { categoriaId: parseInt(categoriaId) } : {}),
      ...(pesoKg !== undefined && pesoKg !== null ? { pesoKg: parseFloat(pesoKg) } : {}),
      esExpress: esExpress === true || esExpress === 'true',
      ...(tiempoEntregaMin ? { tiempoEntregaMin: parseInt(tiempoEntregaMin) } : {}),
    });
  },

  async listar(filtros) {
    return ProductoRepository.listar(filtros);
  },

  async obtenerPorId(id) {
    const producto = await ProductoRepository.buscarPublicoPorId(id);
    if (!producto) throw new ErrorNoEncontrado("Producto no encontrado");
    return producto;
  },

  async misProductos(usuarioId) {
    const comercio = await ComercioRepository.buscarPorUsuarioId(usuarioId);
    if (!comercio) throw new ErrorValidacion("No tienes un comercio registrado");
    return ProductoRepository.listarPorComercio(comercio.id);
  },

  async actualizar(usuarioId, productoId, datos) {
    const comercio = datos.activo === true
      ? await ComercioRepository.buscarPorUsuarioIdConCuenta(usuarioId)
      : await ComercioRepository.buscarPorUsuarioId(usuarioId);
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
    if (datos.stockMinimo !== undefined) campos.stockMinimo = parseInt(datos.stockMinimo) || 0;
    if (datos.stock !== undefined) {
      campos.stock = parseInt(datos.stock);
      // Si se repone stock por encima del mínimo, se resetea el aviso para
      // que una futura venta que vuelva a cruzar el umbral notifique de nuevo.
      const stockMinimoEfectivo = campos.stockMinimo ?? producto.stockMinimo;
      if (stockMinimoEfectivo > 0 && campos.stock > stockMinimoEfectivo) {
        campos.stockBajoNotificadoAt = null;
      }
    }
    if (datos.fotoUrl !== undefined) campos.fotoUrl = datos.fotoUrl;
    if (datos.alcance) {
      if (!ALCANCES_VALIDOS.includes(datos.alcance)) throw new ErrorValidacion("Alcance inválido");
      campos.alcance = datos.alcance;
    }
    if (datos.activo !== undefined) {
      if (Boolean(datos.activo)) assertPuedePublicar(comercio);
      campos.activo = Boolean(datos.activo);
    }
    if (datos.pesoKg !== undefined) {
      campos.pesoKg = datos.pesoKg !== null && datos.pesoKg !== '' ? parseFloat(datos.pesoKg) : null;
    }
    if (datos.categoriaId !== undefined) campos.categoriaId = datos.categoriaId ? parseInt(datos.categoriaId) : null;
    if (datos.esExpress !== undefined) campos.esExpress = datos.esExpress === true || datos.esExpress === 'true';
    if (datos.tiempoEntregaMin !== undefined) campos.tiempoEntregaMin = datos.tiempoEntregaMin ? parseInt(datos.tiempoEntregaMin) : null;

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

  async actualizarVideo(usuarioId, productoId, video) {
    const producto = await this._verificarPropiedad(usuarioId, productoId);
    if (!video?.videoUrl) throw new ErrorValidacion("No se recibio video");

    await limpiarVideoAnterior(producto);

    return ProductoRepository.actualizar(productoId, {
      videoUrl: video.videoUrl,
      videoPosterUrl: video.videoPosterUrl ?? null,
      videoPublicId: video.videoPublicId ?? null,
      videoDuracionSegundos: video.videoDuracionSegundos ?? null,
      videoDuracionOriginalSegundos: video.videoDuracionOriginalSegundos ?? null,
      videoRecorteInicioSegundos: video.videoRecorteInicioSegundos ?? null,
      videoRecorteFinSegundos: video.videoRecorteFinSegundos ?? null,
      videoAncho: video.videoAncho ?? null,
      videoAlto: video.videoAlto ?? null,
      videoBytes: video.videoBytes ?? null,
      videoFormato: video.videoFormato ?? null,
      videoMimeType: video.videoMimeType ?? null,
    });
  },

  async quitarVideo(usuarioId, productoId) {
    const producto = await this._verificarPropiedad(usuarioId, productoId);
    await limpiarVideoAnterior(producto);

    return ProductoRepository.actualizar(productoId, {
      videoUrl: null,
      videoPosterUrl: null,
      videoPublicId: null,
      videoDuracionSegundos: null,
      videoDuracionOriginalSegundos: null,
      videoRecorteInicioSegundos: null,
      videoRecorteFinSegundos: null,
      videoAncho: null,
      videoAlto: null,
      videoBytes: null,
      videoFormato: null,
      videoMimeType: null,
    });
  },

  async guardarVideoLink(usuarioId, productoId, videoUrl) {
    await this._verificarPropiedad(usuarioId, productoId);
    return ProductoRepository.actualizar(productoId, {
      videoUrl,
      videoPosterUrl: null,
      videoPublicId: null,
      videoDuracionSegundos: null,
      videoDuracionOriginalSegundos: null,
      videoRecorteInicioSegundos: null,
      videoRecorteFinSegundos: null,
      videoAncho: null,
      videoAlto: null,
      videoBytes: null,
      videoFormato: null,
      videoMimeType: null,
    });
  },
};

module.exports = ProductoService;

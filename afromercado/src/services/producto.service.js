// Lógica de negocio — Productos
const ProductoRepository = require("../repositories/producto.repository");
const ComercioRepository = require("../repositories/comercio.repository");
const { ErrorValidacion, ErrorNoEncontrado, ErrorNoAutorizado, ErrorProhibido } = require("../utils/errores");
const { eliminarDeCloudinary } = require("../utils/cloudinary");
const { eliminarArchivoLocalDesdeUrl } = require("../utils/video-media");
const { assertPuedePublicar, comercioComprableEnPlataforma } = require("../utils/comercio-publicacion");
const AdminService = require("./admin.service");
const NotificacionService = require("./notificacion.service");
const { enviarMensajeWA } = require("../utils/whatsapp");
const prisma = require("../config/prisma");
const cache = require("../utils/cache");

const UNIDADES_VALIDAS = ["KG", "UNIDAD", "LITRO", "PAQUETE", "DOCENA", "MANOJO", "ANIMAL"];
const ALCANCES_VALIDOS = ["LOCAL", "NACIONAL", "AMBOS"];
const MOTIVOS_DENUNCIA = ["PRODUCTO_FALSO", "ESTAFA_DINERO", "CONTENIDO_INAPROPIADO", "VENDEDOR_SOSPECHOSO", "OTRO"];
const ACCIONES_RESOLVER_DENUNCIA = ["DESESTIMAR", "BLOQUEAR_PRODUCTO", "BLOQUEAR_CUENTA"];

/** Calcula comprableEnPlataforma y elimina los campos internos usados solo para calcularlo. */
function mapearComercioPublico(producto) {
  if (!producto?.comercio) return producto;
  producto.comercio.comprableEnPlataforma = comercioComprableEnPlataforma(producto.comercio);
  delete producto.comercio.rut;
  delete producto.comercio.cuentaDispersion;
  delete producto.comercio.activo;
  delete producto.comercio.estadoRegistro;
  delete producto.comercio.fotoDocumentoUrl;
  delete producto.comercio.fotoDocumentoFrenteUrl;
  delete producto.comercio.fotoDocumentoReversoUrl;
  return producto;
}

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
    if (Number.isNaN(Number(precio)) || Number(precio) <= 0) {
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
    if (stock !== undefined && stock !== null && (!Number.isInteger(Number(stock)) || Number(stock) < 0)) {
      throw new ErrorValidacion("El stock debe ser un número entero mayor o igual a cero");
    }
    if (stockMinimo !== undefined && stockMinimo !== null && (!Number.isInteger(Number(stockMinimo)) || Number(stockMinimo) < 0)) {
      throw new ErrorValidacion("El stock mínimo debe ser un número entero mayor o igual a cero");
    }

    const nuevoProducto = await ProductoRepository.crear({
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
    cache.invalidatePrefix("productos:");
    return nuevoProducto;
  },

  async listar(filtros) {
    const cacheKey = `productos:listar:${JSON.stringify(filtros || {})}`;
    return cache.getOrSet(cacheKey, 60000, async () => {
      const resultado = await ProductoRepository.listar(filtros);
      let items = resultado.items.map(mapearComercioPublico);

      const banners = await prisma.anuncioUbicacion.findMany({
        where: { 
          modulo: 'VITRINA', 
          formato: 'BANNER', 
          activa: true,
          campana: { estado: 'ACTIVA' }
        },
        include: { campana: true },
      });

      const shuffledBanners = banners.sort(() => 0.5 - Math.random()).slice(0, 2);
      let itemsHibridos = [...items];

      if (shuffledBanners[0] && itemsHibridos.length >= 3) {
        itemsHibridos.splice(3, 0, {
          id: `banner-${shuffledBanners[0].id}`,
          esBannerDisplay: true,
          titulo: shuffledBanners[0].titulo,
          subtitulo: shuffledBanners[0].subtitulo,
          mediaUrl: shuffledBanners[0].mediaUrl,
          urlDestino: shuffledBanners[0].urlDestino,
          ctaTexto: shuffledBanners[0].ctaTexto,
          etiqueta: shuffledBanners[0].etiqueta,
        });
      }

      if (shuffledBanners[1] && itemsHibridos.length >= 7) {
        itemsHibridos.splice(7, 0, {
          id: `banner-${shuffledBanners[1].id}`,
          esBannerDisplay: true,
          titulo: shuffledBanners[1].titulo,
          subtitulo: shuffledBanners[1].subtitulo,
          mediaUrl: shuffledBanners[1].mediaUrl,
          urlDestino: shuffledBanners[1].urlDestino,
          ctaTexto: shuffledBanners[1].ctaTexto,
          etiqueta: shuffledBanners[1].etiqueta,
        });
      }

      resultado.items = itemsHibridos;
      return resultado;
    });
  },

  async obtenerPorId(id) {
    const producto = await ProductoRepository.buscarPublicoPorId(id);
    if (!producto) throw new ErrorNoEncontrado("Producto no encontrado");
    return mapearComercioPublico(producto);
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
      if (Number.isNaN(Number(datos.precio)) || Number(datos.precio) <= 0) throw new ErrorValidacion("El precio debe ser mayor a cero");
      campos.precio = parseFloat(datos.precio);
    }
    if (datos.stockMinimo !== undefined) {
      if (!Number.isInteger(Number(datos.stockMinimo)) || Number(datos.stockMinimo) < 0) {
        throw new ErrorValidacion("El stock mínimo debe ser un número entero mayor o igual a cero");
      }
      campos.stockMinimo = parseInt(datos.stockMinimo);
    }
    if (datos.stock !== undefined) {
      if (!Number.isInteger(Number(datos.stock)) || Number(datos.stock) < 0) {
        throw new ErrorValidacion("El stock debe ser un número entero mayor o igual a cero");
      }
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

  // ── Denuncias ─────────────────────────────────────────────────
  // Canal de protección para "venta con contacto directo": el sistema
  // Disputa exige un Pedido ya completado en la plataforma y no aplica
  // a un contacto solo por WhatsApp.
  async denunciar(usuarioId, productoId, { motivo, descripcion }) {
    if (!MOTIVOS_DENUNCIA.includes(motivo)) {
      throw new ErrorValidacion(`Motivo inválido. Opciones: ${MOTIVOS_DENUNCIA.join(", ")}`);
    }
    const producto = await ProductoRepository.buscarConDueno(productoId);
    if (!producto) throw new ErrorNoEncontrado("Producto no encontrado");
    if (producto.comercio?.usuarioId === usuarioId) {
      throw new ErrorProhibido("No puedes denunciar tu propio producto");
    }
    const existente = await ProductoRepository.buscarDenuncia(productoId, usuarioId);
    if (existente) throw new ErrorValidacion("Ya denunciaste este producto");

    const denuncia = await ProductoRepository.crearDenuncia({
      productoId,
      denuncianteId: usuarioId,
      motivo,
      descripcion: descripcion?.trim() || null,
    });

    // Aviso urgente por WhatsApp al admin — no depende del asistente de IA
    // (ANTHROPIC_API_KEY), solo de que WhatsApp esté conectado (enviarMensajeWA
    // ya es un no-op silencioso si no lo está).
    if (motivo === "ESTAFA_DINERO") {
      setImmediate(async () => {
        try {
          const admins = await prisma.usuario.findMany({
            where: { rol: "ADMIN", telefono: { not: null } },
            select: { telefono: true },
          });
          const texto = `🚨 Denuncia de estafa en Teravia\n\nProducto: "${producto.nombre}"\nID producto: ${productoId}\n\nRevísala en /admin/productos (pestaña Denuncias).`;
          for (const admin of admins) {
            await enviarMensajeWA(admin.telefono, texto);
          }
        } catch (e) {
          console.error("[NOTIF] aviso admin denuncia estafa:", e.message);
        }
      });
    }

    return denuncia;
  },

  async listarDenunciasPendientes() {
    return ProductoRepository.listarDenunciasPendientes();
  },

  async resolverDenuncia(adminId, denunciaId, { accion, motivo }) {
    if (!ACCIONES_RESOLVER_DENUNCIA.includes(accion)) {
      throw new ErrorValidacion(`Acción inválida. Opciones: ${ACCIONES_RESOLVER_DENUNCIA.join(", ")}`);
    }
    const denuncia = await ProductoRepository.buscarDenunciaPorId(denunciaId);
    if (!denuncia) throw new ErrorNoEncontrado("Denuncia no encontrada");
    if (denuncia.estado !== "PENDIENTE") {
      throw new ErrorValidacion("Esta denuncia ya fue resuelta");
    }

    if (accion === "BLOQUEAR_PRODUCTO") {
      await ProductoRepository.actualizar(denuncia.productoId, { activo: false });
      const resultado = await ProductoRepository.actualizarDenuncia(denunciaId, {
        estado: "PRODUCTO_BLOQUEADO",
        revisadoPor: adminId,
        revisadoAt: new Date(),
        notaRevision: motivo?.trim() || null,
      });

      const usuarioIdComercio = denuncia.producto.comercio.usuarioId;
      if (usuarioIdComercio) {
        setImmediate(() => {
          NotificacionService.crearYEnviar({
            usuarioId: usuarioIdComercio,
            tipo: "PRODUCTO_BLOQUEADO",
            titulo: "Un producto tuyo fue bloqueado",
            mensaje: `"${denuncia.producto.nombre}" fue retirado del catálogo tras una denuncia. ${motivo?.trim() || "Revisa que cumpla las normas de la comunidad."}`,
          }).catch((e) => console.error("[NOTIF] resolverDenuncia producto:", e.message));
        });
      }

      return resultado;
    }

    if (accion === "BLOQUEAR_CUENTA") {
      const comercioId = denuncia.producto.comercio.id;
      await AdminService.verificarComerciante(adminId, comercioId, { accion: "SUSPENDER", motivo: motivo?.trim() || "Denuncias de productos" });
      await ProductoRepository.resolverDenunciasPendientesDelComercio(comercioId, "CUENTA_BLOQUEADA", adminId, motivo?.trim() || null);
      return ProductoRepository.buscarDenunciaPorId(denunciaId);
    }

    // DESESTIMAR
    return ProductoRepository.actualizarDenuncia(denunciaId, {
      estado: "DESESTIMADA",
      revisadoPor: adminId,
      revisadoAt: new Date(),
      notaRevision: motivo?.trim() || null,
    });
  },
};

module.exports = ProductoService;

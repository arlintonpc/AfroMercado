const DireccionRepository = require("../repositories/direccion.repository");
const { ErrorValidacion, ErrorNoEncontrado, ErrorProhibido } = require("../utils/errores");
const { validarUbicacion } = require("../utils/ubicacion");

const MAX_DIRECCIONES = 10;

function validarDatos(datos) {
  const e = [];
  if (!datos.alias?.trim()) e.push("El alias es obligatorio (ej: Casa, Oficina).");
  else if (datos.alias.trim().length > 40) e.push("El alias no puede superar 40 caracteres.");

  if (!datos.linea1?.trim()) e.push("La dirección es obligatoria.");
  else if (datos.linea1.trim().length > 200) e.push("La dirección no puede superar 200 caracteres.");

  if (!datos.municipio?.trim()) e.push("El municipio es obligatorio.");
  if (!datos.departamento?.trim()) e.push("El departamento es obligatorio.");

  if (datos.telefono) {
    const tel = datos.telefono.replace(/\D/g, "");
    if (tel.length !== 10) e.push("El teléfono debe tener 10 dígitos.");
  }

  if (e.length) throw new ErrorValidacion(e.join(" "));

  validarUbicacion(datos.departamento.trim(), datos.municipio.trim());
}

const DireccionService = {
  async listar(usuarioId) {
    return DireccionRepository.listarPorUsuario(usuarioId);
  },

  async crear(usuarioId, datos) {
    validarDatos(datos);

    const total = await DireccionRepository.contarPorUsuario(usuarioId);
    if (total >= MAX_DIRECCIONES) {
      throw new ErrorValidacion(`Máximo ${MAX_DIRECCIONES} direcciones guardadas. Elimina una antes de agregar.`);
    }

    // Si es la primera dirección, marcarla como principal automáticamente
    const esPrincipal = total === 0 ? true : (datos.esPrincipal ?? false);

    if (esPrincipal && total > 0) {
      await DireccionRepository.quitarPrincipal(usuarioId);
    }

    const telefono = datos.telefono ? datos.telefono.replace(/\D/g, "") : null;

    return DireccionRepository.crear(usuarioId, {
      ...datos,
      telefono,
      esPrincipal,
    });
  },

  async actualizar(id, usuarioId, datos) {
    validarDatos(datos);

    const existente = await DireccionRepository.buscarPorId(id, usuarioId);
    if (!existente) throw new ErrorNoEncontrado("Dirección no encontrada.");

    if (datos.esPrincipal && !existente.esPrincipal) {
      await DireccionRepository.quitarPrincipal(usuarioId);
    }

    const telefono = datos.telefono ? datos.telefono.replace(/\D/g, "") : null;

    return DireccionRepository.actualizar(id, usuarioId, { ...datos, telefono });
  },

  async eliminar(id, usuarioId) {
    const existente = await DireccionRepository.buscarPorId(id, usuarioId);
    if (!existente) throw new ErrorNoEncontrado("Dirección no encontrada.");

    await DireccionRepository.eliminar(id, usuarioId);

    // Si era la principal y quedan más, promover la primera como principal
    if (existente.esPrincipal) {
      const restantes = await DireccionRepository.listarPorUsuario(usuarioId);
      if (restantes.length > 0) {
        await DireccionRepository.marcarPrincipal(restantes[0].id, usuarioId);
      }
    }
  },

  async marcarPrincipal(id, usuarioId) {
    const existente = await DireccionRepository.buscarPorId(id, usuarioId);
    if (!existente) throw new ErrorNoEncontrado("Dirección no encontrada.");
    return DireccionRepository.marcarPrincipal(id, usuarioId);
  },
};

module.exports = DireccionService;

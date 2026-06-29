// ============================================================
//  Servicio de Usuario — lógica de negocio del perfil
// ============================================================
const UsuarioRepository = require("../repositories/usuario.repository");
const { ErrorValidacion, ErrorNoEncontrado, ErrorNoAutorizado } = require("../utils/errores");
const bcrypt = require("bcryptjs");
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "10", 10);

const UsuarioService = {
  async obtenerPerfil(id) {
    const usuario = await UsuarioRepository.buscarPorId(id);
    if (!usuario || !usuario.activo) throw new ErrorNoEncontrado("Usuario no encontrado");
    const { passwordHash, deletedAt, ...publico } = usuario;
    return publico;
  },

  async actualizarPerfil(id, datos) {
    const permitidos = ["nombre", "telefono", "tipoDocumento", "numeroDocumento", "municipio", "departamento"];
    const actualizacion = {};

    for (const campo of permitidos) {
      if (datos[campo] !== undefined) actualizacion[campo] = datos[campo];
    }

    if (actualizacion.nombre !== undefined) {
      actualizacion.nombre = String(actualizacion.nombre).trim();
      if (actualizacion.nombre.length < 2)
        throw new ErrorValidacion("El nombre debe tener al menos 2 caracteres");
      if (actualizacion.nombre.length > 100)
        throw new ErrorValidacion("El nombre no puede superar 100 caracteres");
    }

    if (actualizacion.telefono !== undefined && actualizacion.telefono !== null) {
      const tel = String(actualizacion.telefono).replace(/\D/g, "");
      if (tel.length !== 10) throw new ErrorValidacion("El teléfono debe tener 10 dígitos");
      // Verificar que no lo use otro usuario
      const existente = await UsuarioRepository.buscarPorTelefono(tel);
      if (existente && existente.id !== id)
        throw new ErrorValidacion("Ese número de teléfono ya está registrado");
      actualizacion.telefono = tel;
    }

    if (Object.keys(actualizacion).length === 0)
      throw new ErrorValidacion("No hay datos válidos para actualizar");

    const actualizado = await UsuarioRepository.actualizar(id, actualizacion);
    const { passwordHash, deletedAt, ...publico } = actualizado;
    return publico;
  },

  async cambiarPassword(id, { passwordActual, passwordNueva }) {
    if (!passwordActual || !passwordNueva)
      throw new ErrorValidacion("Se requieren la contraseña actual y la nueva.");
    if (passwordNueva.length < 6)
      throw new ErrorValidacion("La nueva contraseña debe tener al menos 6 caracteres.");

    const usuario = await UsuarioRepository.buscarPorId(id);
    if (!usuario || !usuario.activo) throw new ErrorNoEncontrado("Usuario no encontrado");

    const coincide = await bcrypt.compare(passwordActual, usuario.passwordHash);
    if (!coincide) throw new ErrorNoAutorizado("La contraseña actual no es correcta.");

    const nuevoHash = await bcrypt.hash(passwordNueva, BCRYPT_ROUNDS);
    await UsuarioRepository.actualizar(id, { passwordHash: nuevoHash });
  },
};

module.exports = UsuarioService;

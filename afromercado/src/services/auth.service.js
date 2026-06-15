// ============================================================
//  Servicio de Autenticación — lógica de negocio
//  Orquesta el registro y login. No habla directo con la BD;
//  usa el repositorio.
// ============================================================
const UsuarioRepository = require("../repositories/usuario.repository");
const { hashearPassword, compararPassword, generarToken } = require("../utils/auth");
const { ErrorValidacion, ErrorNoAutorizado } = require("../utils/errores");

const ROLES_VALIDOS = ["COMPRADOR", "COMERCIANTE", "REPARTIDOR"];

const AuthService = {
  async registrar({ nombre, email, telefono, password, rol }) {
    // Validaciones de negocio
    if (!nombre || !email || !telefono || !password) {
      throw new ErrorValidacion("Nombre, email, teléfono y contraseña son obligatorios");
    }
    if (password.length < 6) {
      throw new ErrorValidacion("La contraseña debe tener al menos 6 caracteres");
    }
    const rolFinal = rol && ROLES_VALIDOS.includes(rol) ? rol : "COMPRADOR";

    // No permitir correos ni teléfonos duplicados
    if (await UsuarioRepository.buscarPorEmail(email)) {
      throw new ErrorValidacion("Ya existe una cuenta con ese correo");
    }
    if (await UsuarioRepository.buscarPorTelefono(telefono)) {
      throw new ErrorValidacion("Ya existe una cuenta con ese teléfono");
    }

    const passwordHash = await hashearPassword(password);
    const usuario = await UsuarioRepository.crear({
      nombre, email, telefono, passwordHash, rol: rolFinal,
    });

    return this._respuestaConToken(usuario);
  },

  async login({ email, password }) {
    if (!email || !password) {
      throw new ErrorValidacion("Email y contraseña son obligatorios");
    }
    const usuario = await UsuarioRepository.buscarPorEmail(email);
    if (!usuario) {
      throw new ErrorNoAutorizado("Correo o contraseña incorrectos");
    }
    const passwordOk = await compararPassword(password, usuario.passwordHash);
    if (!passwordOk) {
      throw new ErrorNoAutorizado("Correo o contraseña incorrectos");
    }
    return this._respuestaConToken(usuario);
  },

  // Arma la respuesta sin exponer el hash de la contraseña
  _respuestaConToken(usuario) {
    const token = generarToken({ id: usuario.id, rol: usuario.rol });
    return {
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        telefono: usuario.telefono,
        rol: usuario.rol,
      },
    };
  },
};

module.exports = AuthService;

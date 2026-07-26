// ============================================================
//  Servicio de Autenticación — lógica de negocio
//  Orquesta el registro y login. No habla directo con la BD;
//  usa el repositorio.
// ============================================================
const UsuarioRepository = require("../repositories/usuario.repository");
const { hashearPassword, compararPassword, generarToken } = require("../utils/auth");
const { ErrorValidacion, ErrorNoAutorizado } = require("../utils/errores");
const FidelizacionService = require("./fidelizacion.service");

const ROLES_VALIDOS = ["COMPRADOR", "COMERCIANTE", "REPARTIDOR"];

const AuthService = {
  async registrar(datos) {
    const { nombre, email, telefono, password, rol } = datos;
    // Validaciones de negocio
    if (!nombre || !email || !telefono || !password) {
      throw new ErrorValidacion("Nombre, email, teléfono y contraseña son obligatorios");
    }
    if (password.length < 6) {
      throw new ErrorValidacion("La contraseña debe tener al menos 6 caracteres");
    }
    if (!datos.autorizacionDatos) {
      throw new ErrorValidacion("Debes aceptar la autorización de tratamiento de datos personales.");
    }
    const rolFinal = rol && ROLES_VALIDOS.includes(rol) ? rol : "COMPRADOR";

    // No permitir correos ni teléfonos duplicados
    const emailNormalizado = String(email).toLowerCase().trim();

    if (await UsuarioRepository.buscarPorEmail(emailNormalizado)) {
      throw new ErrorValidacion("Ya existe una cuenta con ese correo");
    }
    if (await UsuarioRepository.buscarPorTelefono(telefono)) {
      throw new ErrorValidacion("Ya existe una cuenta con ese teléfono");
    }

    const passwordHash = await hashearPassword(password);
    const usuario = await UsuarioRepository.crear({
      nombre: nombre.trim(),
      email: emailNormalizado,
      telefono: telefono?.trim(),
      passwordHash,
      rol: rolFinal,
      autorizacionDatos: true,
      autorizacionFecha: new Date(),
      tipoDocumento: datos.tipoDocumento || null,
      numeroDocumento: datos.numeroDocumento ? datos.numeroDocumento.trim() : null,
    });

    // Crea el perfil de fidelización desde ya (código propio + referido, si vino uno)
    // — el bono al referidor se otorga después, en la primera compra confirmada.
    FidelizacionService.obtenerOCrearPerfil(usuario.id, datos.codigoReferido).catch((e) =>
      console.error("[FIDELIZACION] no se pudo crear el perfil al registrar:", e.message)
    );

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
    if (!usuario.activo) {
      throw new ErrorNoAutorizado("Tu cuenta está inactiva. Contacta al administrador.");
    }
    const passwordOk = await compararPassword(password, usuario.passwordHash);
    if (!passwordOk) {
      throw new ErrorNoAutorizado("Correo o contraseña incorrectos");
    }
    return this._respuestaConToken(usuario);
  },

  async loginSocialGoogle({ credential, idToken }) {
    const token = credential || idToken;
    if (!token) throw new ErrorValidacion("Token de Google es obligatorio");

    let payload;
    try {
      const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error("Token no valido");
      payload = await res.json();
    } catch {
      throw new ErrorValidacion("Token de Google no válido o expirado");
    }

    const { sub: googleId, email, name: nombre, picture: avatarUrl } = payload;
    if (!email || !googleId) {
      throw new ErrorValidacion("La cuenta de Google no contiene un correo electrónico verificado");
    }

    const emailNormalizado = String(email).toLowerCase().trim();
    let usuario = await UsuarioRepository.buscarPorGoogleId(googleId);
    if (!usuario) {
      usuario = await UsuarioRepository.buscarPorEmail(emailNormalizado);
    }

    if (usuario) {
      if (!usuario.googleId) {
        await UsuarioRepository.actualizar(usuario.id, {
          googleId,
          provider: "GOOGLE",
          avatarUrl: usuario.avatarUrl || avatarUrl || null,
        });
      }
    } else {
      usuario = await UsuarioRepository.crear({
        nombre: nombre ? nombre.trim() : "Usuario Google",
        email: emailNormalizado,
        googleId,
        avatarUrl: avatarUrl || null,
        provider: "GOOGLE",
        rol: "COMPRADOR",
        autorizacionDatos: true,
        autorizacionFecha: new Date(),
      });
      FidelizacionService.obtenerOCrearPerfil(usuario.id).catch((e) =>
        console.error("[FIDELIZACION] no se pudo crear perfil:", e.message)
      );
    }

    if (!usuario.activo) {
      throw new ErrorNoAutorizado("Tu cuenta está inactiva. Contacta al administrador.");
    }
    return this._respuestaConToken(usuario);
  },

  async loginSocialMicrosoft({ email, nombre, id, avatarUrl }) {
    if (!email || !id) {
      throw new ErrorValidacion("Datos de perfil de Microsoft insuficientes");
    }
    const emailNormalizado = String(email).toLowerCase().trim();
    let usuario = await UsuarioRepository.buscarPorMicrosoftId(id);
    if (!usuario) {
      usuario = await UsuarioRepository.buscarPorEmail(emailNormalizado);
    }

    if (usuario) {
      if (!usuario.microsoftId) {
        await UsuarioRepository.actualizar(usuario.id, {
          microsoftId: id,
          provider: "MICROSOFT",
          avatarUrl: usuario.avatarUrl || avatarUrl || null,
        });
      }
    } else {
      usuario = await UsuarioRepository.crear({
        nombre: nombre ? nombre.trim() : "Usuario Hotmail",
        email: emailNormalizado,
        microsoftId: id,
        avatarUrl: avatarUrl || null,
        provider: "MICROSOFT",
        rol: "COMPRADOR",
        autorizacionDatos: true,
        autorizacionFecha: new Date(),
      });
      FidelizacionService.obtenerOCrearPerfil(usuario.id).catch((e) =>
        console.error("[FIDELIZACION] no se pudo crear perfil:", e.message)
      );
    }

    if (!usuario.activo) {
      throw new ErrorNoAutorizado("Tu cuenta está inactiva. Contacta al administrador.");
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
        avatarUrl: usuario.avatarUrl,
        rol: usuario.rol,
      },
    };
  },
};

module.exports = AuthService;

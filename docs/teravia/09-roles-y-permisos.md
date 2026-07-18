# Anexo C — Arquitectura de Roles y Permisos

*Documento técnico complementario del Proyecto Maestro TERAVIA. Versión viva.*
*Última actualización: 2026-07-17.*

## Propósito

Documentar el sistema de roles **tal como existe hoy**, con evidencia exacta del código (no aspiracional), identificar el hueco real que va a doler cuando el vertical institucional (Capítulo 1, Capítulo 6) crezca, y proponer una evolución mínima — no una reescritura del sistema de autorización.

---

## 1. El sistema real hoy: 4 roles planos, sin jerarquía

```prisma
enum Rol {
  COMPRADOR
  COMERCIANTE
  REPARTIDOR
  ADMIN
}
```

`Usuario.rol` es un único campo enum — no hay sub-roles, no hay permisos granulares, no hay tabla de permisos. La autorización en cada ruta es una lista de roles permitidos:

```js
function autorizar(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return next(new ErrorProhibido("Tu rol no tiene permiso para esta acción"));
    }
    next();
  };
}
```

Es un modelo simple, correcto para lo que resuelve hoy, y **no se propone reemplazarlo** — la recomendación de este documento es extenderlo con cuidado, no reescribirlo (misma filosofía del Anexo B).

## 2. Matriz de capacidades real, por dominio (auditada directamente de las rutas)

| Dominio | COMPRADOR | COMERCIANTE | REPARTIDOR | ADMIN |
|---|:---:|:---:|:---:|:---:|
| Registrar/editar su propio comercio | ✔ (al convertirse) | ✔ | — | ✔ |
| Crear/editar/borrar Producto | — | ✔ | — | ✔ |
| Carrito, Pedido, Pago (como comprador) | ✔ | ✔ | ✔ | — |
| Dejar Reseña | ✔ | ✔ | — | — |
| Crear Cupón propio de comercio | — | ✔ | — | ✔ |
| Crear Cupón global/plataforma | — | — | — | ✔ |
| Ver reportes de su propio comercio | — | ✔ | — | ✔ |
| Ver reportes de toda la plataforma | — | — | — | ✔ |
| Gestionar entregas/asignación de repartidor | — | — | (autoservicio) | ✔ |
| Ver sus propias liquidaciones | — | ✔ | ✔ | ✔ |
| Responder/crear disputa | ✔ (crear) | ✔ | — | ✔ |
| Organizar evento cultural | — | ✔ | — | ✔ |
| Gestionar alianzas comerciales | — | ✔ | — | — |
| Configuración global (hero, campañas, tarifas envío, fiscal, facturación, PQRSD, subida de archivos de plataforma) | — | — | — | ✔ (exclusivo) |

**Lectura del patrón:** el sistema distingue bien entre "dueño de su propio recurso" (comercio, productos, liquidaciones) y "administración de toda la plataforma" — pero **todo lo segundo cae en un único rol ADMIN sin separación interna**. No existe distinción entre, por ejemplo, quien aprueba comercios nuevos, quien gestiona pagos/dispersión, y quien administra configuración de marca/campañas — hoy cualquier cuenta ADMIN puede hacer las tres cosas.

## 3. Atributos que actúan como permisos pero no son roles — no confundir

Varios campos del modelo `Comercio` funcionan como *capacidades condicionales* dentro del rol COMERCIANTE, no como roles nuevos:

- `verificado` — habilita que el comercio venda de verdad (gate ya reforzado en el Sprint de 30 días con el requisito de RUT).
- `disponibleComprasPublicas` — habilita aparecer en el directorio B2G (autoservicio del comerciante, sin aprobación adicional — Anexo A, sección A.2).
- `verificadoEtnico` — sello, otorgado solo por ADMIN, sin efecto sobre qué puede hacer el comercio.

Esto es correcto y no debe convertirse en roles — son atributos de estado sobre un recurso (Comercio), no identidades de quien actúa.

## 4. El hueco real: no existe ningún rol institucional

El vertical institucional (alcaldías, gobernaciones — Capítulo 1 sección 1.8, Capítulo 6 sección 6.1) no tiene ninguna representación en `enum Rol` hoy. El Directorio B2G (Anexo A, sección A.2) es de solo lectura y sin autenticación — funciona hoy precisamente porque **no requiere que una alcaldía tenga cuenta ni rol en el sistema**. Pero en el momento en que TERAVIA venda un producto real a una entidad territorial (TERAVIA Gobierno/Municipio, si se llega a construir según la visión de largo plazo), esa entidad va a necesitar iniciar sesión, ver métricas de su propio territorio, y no de otro — y hoy no hay ningún mecanismo para eso.

**No se propone crear este rol ahora.** Se documenta como hueco conocido, a resolver cuando exista un convenio institucional real (mismo criterio de "no construir antes de que exista la necesidad" que ya se aplicó en el Capítulo 3 para Bienes Raíces e IA).

## 5. El segundo hueco real: ADMIN es monolítico, sin separación de funciones

Esto es más urgente que el rol institucional porque **ya existe hoy con el equipo actual de un solo operador** — pero se vuelve un riesgo real en el momento en que TERAVIA tenga más de una persona con acceso ADMIN (Capítulo 4, sección 4.1.1 — dependencia de un solo operador). Sin separación de funciones, cualquier cuenta ADMIN puede:

- Aprobar/rechazar comercios (incluyendo el propio, si se diera el caso)
- Configurar comisiones por comercio
- Activar/desactivar la pasarela de pagos (Anexo A, sección A.1)
- Modificar campañas, hero, marca

Para un equipo de una persona esto no importa. Para un equipo de tres o más — el escenario que el Capítulo 4 ya identificó como necesario — sí importa, particularmente para cualquier auditoría externa (Fondo Emprender, un inversionista, o incluso el Registro Nacional de Bases de Datos si el volumen de datos crece — Capítulo 2, sección 2.6).

## 6. Propuesta de evolución — mínima, no una reescritura

**No se propone tocar `enum Rol` todavía.** La recomendación es:

1. **Cuando se incorpore una segunda persona con acceso administrativo** (no antes): agregar un campo `permisosAdmin String[]` (o una tabla `PermisoAdmin` simple) sobre `Usuario`, con valores como `APROBAR_COMERCIOS`, `GESTIONAR_PAGOS`, `CONFIGURAR_MARCA` — verificado en el middleware `autorizar()` extendido, sin romper ninguna ruta existente (todo ADMIN actual mantiene todos los permisos por defecto, backward-compatible).
2. **Cuando exista el primer convenio institucional real**: agregar `INSTITUCIONAL` a `enum Rol`, con acceso de solo lectura acotado a su propio territorio (`departamento`/`municipio` del usuario, ya existente en `Usuario`) — reutilizando campos que ya están en el modelo, no inventando estructura nueva.

Ninguna de las dos acciones es necesaria hoy. Se documentan para que, cuando la necesidad llegue, no se improvise una solución — se ejecute esta.

---

## 7. Síntesis

1. El sistema de 4 roles planos es simple y correcto para el estado actual de TERAVIA — no se propone cambiarlo por cambiarlo.
2. El hueco de rol institucional es real pero no urgente — se resuelve cuando exista el primer convenio, no antes.
3. El hueco de separación de funciones dentro de ADMIN sí se vuelve urgente en el momento exacto en que se incorpore una segunda persona con acceso administrativo — vale la pena tenerlo diseñado (sección 6) antes de que ese momento llegue, no después.
4. No se ejecuta ningún cambio de código a partir de este documento sin necesidad concreta que lo dispare.

---

*Referencia: [Capítulo 4 — Gobernanza, sección 4.1.1](04-gobernanza-marca-sostenibilidad.md) · [Anexo A, sección A.2 — Directorio B2G](07-auditoria-tecnica-modulos-parciales.md) · [Anexo B — Arquitectura de Plataforma](08-arquitectura-plataforma-nucleo-vs-verticales.md)*

## 8. Matriz operativa para implementar sin ambigüedad

Esta matriz no redefine el sistema. Solo traduce la arquitectura actual a reglas que se puedan revisar, implementar y auditar sin discutir cada ruta una por una.

| Rol | Puede hacer | No debe hacer | Rutas o dominios de referencia |
|---|---|---|---|
| COMPRADOR | Navegar, comprar, pagar, opinar, abrir PQRSD/disputas, guardar favoritos, postularse a empleo | Administrar comercios, tocar comisiones, aprobar contenidos o ver reportes globales | `/carrito`, `/checkout`, `/mis-pedidos`, `/mis-favoritos`, `/empleo`, `/pqrsd`, `/mis-disputas` |
| COMERCIANTE | Gestionar su comercio, productos, contenidos de su vertical, cupones propios, alianzas, reportes de su negocio | Cambiar marca global, ver datos de otros comercios, aprobarse a sí mismo, tocar configuración institucional | `/comerciante/*`, `/producto`, `/express`, `/hoteles`, `/tours`, `/transportes`, `/cultura`, `/alianzas`, `/reportes` con alcance propio |
| REPARTIDOR | Gestionar su perfil, atender entregas, ver sus liquidaciones y su actividad operativa | Editar comercios, configurar pagos, ver analítica global o contenido institucional | `/repartidor/*`, `/envios`, `/mis-liquidaciones` |
| ADMIN | Aprobar comercios, gestionar pagos, dispersión, marca, campañas, moderación, liquidaciones, facturación, PQRSD y analítica global | Asumir permisos institucionales inexistentes, romper el alcance de otros roles, mezclar funciones sensibles sin separación | `/admin/*`, `/reportes/admin`, `/config`, `/facturacion`, `/pqrsd`, `/datos-abiertos` en gestión |
| INSTITUCIONAL | Ver métricas de su propio territorio, directorio y analítica acotada a su convenio | Ver datos de otros territorios o ejecutar operaciones transaccionales | No existe todavía; debería nacer como panel específico o ruta acotada por convenio |

### 8.1 Permisos internos sugeridos para `ADMIN`

Si el equipo crece, `ADMIN` debería dividirse en permisos explícitos, sin tocar el rol base:

- `APROBAR_COMERCIOS`
- `GESTIONAR_PAGOS`
- `GESTIONAR_DISPERSIONES`
- `CONFIGURAR_MARCA`
- `GESTIONAR_CAMPANAS`
- `MODERAR_CONTENIDO`
- `GESTIONAR_FISCAL`
- `GESTIONAR_FACTURACION`
- `GESTIONAR_PQRSD`
- `VER_ANALITICA_GLOBAL`
- `GESTIONAR_DATOS_ABIERTOS`
- `GESTIONAR_ALIANZAS_INSTITUCIONALES`

### 8.2 Reglas de implementación

- Si un usuario tiene `rol = ADMIN` y no existe `permisosAdmin`, se mantiene el comportamiento actual completo para no romper compatibilidad.
- Si un usuario tiene `rol = ADMIN` y sí tiene `permisosAdmin`, las rutas sensibles deberían validar el permiso específico antes de ejecutar la acción.
- Ningún permiso nuevo debe deducirse desde `verificado`, `disponibleComprasPublicas` o `verificadoEtnico`; esos campos siguen siendo atributos del comercio, no identidades del usuario.
- Cualquier vertical institucional futuro debería scoping por territorio real y no solo por texto libre de municipio o departamento.
- Si una ruta nueva mezcla moderación, dinero y marca, debe dividirse antes de asignarle un único permiso.

---

*Referencia: [Capítulo 4 — Gobernanza, sección 4.1.1](04-gobernanza-marca-sostenibilidad.md) · [Anexo A, sección A.2 — Directorio B2G](07-auditoria-tecnica-modulos-parciales.md) · [Anexo B — Arquitectura de Plataforma](08-arquitectura-plataforma-nucleo-vs-verticales.md)*
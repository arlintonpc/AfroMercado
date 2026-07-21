# AfroMercado / Teravia — Diseño de monetización (propuesta para discutir)

> Este documento es una **propuesta de diseño, no un plan aprobado**. Nada de esto está implementado. Es la maduración de la conversación sobre cómo debería funcionar la comisión, las excepciones por comercio, el default por módulo, y un eventual modelo de suscripción — incluyendo qué hacer con Empleo, que es estructuralmente distinto al resto.
>
> Fecha: 2026-07-19. Relacionado con `AUDITORIA.md` sección 7 (propuesta #1) y sección 2 (hallazgos 2.1/2.2).

## 0. La distinción que cambia todo el diseño

Hoy el proyecto trata "comisión" como si fuera un solo concepto aplicable a todo. No lo es. Hay dos preguntas distintas que se están mezclando:

1. **¿Pasa dinero por la plataforma en este módulo?** — Marketplace, Express, Hotel, Tour, Transporte y Cultura (boletería) tienen un checkout real: la plataforma cobra, retiene su parte, dispersa el resto. Ahí "comisión" tiene sentido matemático (un % de un monto real).
2. **¿Hay algo que monetizar aunque no haya transacción?** — Empleo, Bienes Raíces y Cultura ("Comparte tu Chocó") son **vitrinas**, no checkouts. No hay un monto sobre el cual calcular un porcentaje. Ahí la pregunta correcta no es "¿cuánta comisión?" sino "¿existe algún servicio de valor añadido por el que alguien pagaría, sabiendo que la publicación base debe seguir siendo gratis por diseño (ver `empleo_publicacion_apertura` — decisión ya tomada y reafirmada de que cualquiera pueda publicar)?"

Tu intuición ("Empleo es social... pero debería [generar algo]") es exactamente esta tensión. La resuelve no forzando una comisión donde no cabe, sino poniéndola en una capa distinta (§3).

---

## 1. Estado actual (para no repetir lo ya diagnosticado)

| Módulo | Tiene comisión hoy | Mecanismo |
|---|---|---|
| Marketplace/Pedido | Sí | Cascada real: `ComisionComercio` (override + vigencia) → `Config.comision_global` → `config.comisionPorcentaje` (env) |
| Express | Sí | Misma cascada que Marketplace |
| Hotel | Sí | **Fijo 10% hardcodeado**, sin cascada, sin poder excepcionar a nadie |
| Tour | Sí | Igual que Hotel |
| Transporte | Sí (recién agregado) | Fijo 10%, sin cascada — se implementó igual que Hotel/Tour por decisión tuya del 2026-07-19 |
| Cultura (boletería) | Sí | Fijo 10% |
| Empleo | No existe (no hay transacción) | — |
| Bienes Raíces | No existe (no hay transacción) | — |

El problema no es solo que Hotel/Tour/Transporte/Cultura no tengan cascada — es que **existen 4 implementaciones independientes** del mismo concepto (`TASA_COMISION_TOUR`, `TASA_COMISION_CULTURA`, la constante nueva de Transporte, la cascada de Marketplace/Express), cada una copiada por analogía. Cualquier cambio de reglas de negocio (ej. "bajemos comisión al 8% este trimestre") hoy requiere tocar código en 4-6 archivos distintos y hacer deploy.

---

## 2. Capa 1 — Comisión transaccional unificada

### Modelo de datos propuesto

```prisma
// Reemplaza las constantes hardcodeadas por módulo (TASA_COMISION_TOUR, etc.)
model ComisionModulo {
  id       Int      @id @default(autoincrement())
  modulo   String   @unique   // "PEDIDO" | "EXPRESS" | "HOTEL" | "TOUR" | "TRANSPORTE" | "CULTURA"
  tasa     Decimal  @db.Decimal(5, 4)
  activo   Boolean  @default(true)
  updatedAt DateTime @updatedAt
}

// Ya existe — se le agrega `modulo` (nullable = aplica a todos los módulos de ese comercio)
model ComisionComercio {
  id          Int       @id @default(autoincrement())
  comercioId  Int
  modulo      String?   // NUEVO: null = override general, o un módulo específico
  tasa        Decimal   @db.Decimal(5, 4)
  motivo      String?   // NUEVO: nota del admin — por qué esta excepción ("alianza institucional", "productor piloto Chocó Sur", etc.)
  desde       DateTime
  hasta       DateTime?
  creadoPorId Int

  @@index([comercioId, modulo])
}
```

### Cascada de resolución (una sola función, usada por los 6 módulos)

```
resolverTasaComision(comercioId, modulo):
  1. ComisionComercio WHERE comercioId=X AND modulo=<específico> AND vigente   → si existe, úsala
  2. ComisionComercio WHERE comercioId=X AND modulo IS NULL AND vigente        → override general del comercio
  3. ComisionModulo WHERE modulo=<módulo> AND activo                          → default del vertical
  4. Config.comision_global (tabla Config, ya existe)                          → fallback histórico
  5. config.comisionPorcentaje (env, 0.10)                                     → última red de seguridad
```

Esto reemplaza las 6 implementaciones actuales por **una función en `utils/comision.js`**, llamada desde Marketplace, Express, Hotel, Tour, Transporte y Cultura. Un comercio puede tener: 0% en todo (`modulo: null, tasa: 0`), 0% solo en Hotel pero 10% en el resto (`modulo: "HOTEL", tasa: 0`), o una tasa especial en Marketplace por ser parte de un piloto institucional — todo sin tocar código, desde un panel admin.

### Panel admin propuesto

Una página nueva `/admin/comisiones`:
- Tabla de `ComisionModulo` — editar el default de cada vertical (6 filas, un slider/input por módulo).
- Buscador de comercio → ver/crear overrides (`ComisionComercio`), con motivo obligatorio (auditoría de por qué se le dio la excepción) y vigencia opcional.
- Vista de "quién tiene excepción activa hoy" — para que no se pierda de vista cuántos comercios están pagando menos del default.

### Por qué esto es de bajo riesgo técnico

No cambia el modelo de negocio actual (los defaults se siembran iguales a lo que ya cobra cada módulo hoy — 10% en todos), solo centraliza dónde vive esa configuración. Es aditivo: nada dejaría de funcionar si no se usa ningún override.

---

## 3. Capa 2 — Suscripción (fee fijo recurrente)

Independiente de la comisión — un comercio puede estar en comisión pura, en suscripción, o en un híbrido (suscripción + comisión reducida). Es el mecanismo correcto para vender algo cuando no hay una transacción de la cual descontar un %.

### Modelo de datos propuesto

```prisma
model PlanSuscripcion {
  id          Int      @id @default(autoincrement())
  nombre      String   // "Plan Comercio Pro"
  precio      Decimal  @db.Decimal(10, 2)
  periodicidad String  // "MENSUAL" | "ANUAL"
  beneficios  Json     // { comisionOverride: 0.05, empleoIlimitado: true, destacadoIncluido: 3 }
  activo      Boolean  @default(true)
}

model SuscripcionComercio {
  id             Int       @id @default(autoincrement())
  comercioId     Int       @unique
  planId         Int
  estado         String    // "ACTIVA" | "VENCIDA" | "CANCELADA"
  inicioVigencia DateTime
  finVigencia    DateTime
  metodoPago     String
  ultimoCobroAt  DateTime?
  proximoCobroAt DateTime?
}
```

### Consideraciones operativas (esto es lo que hace que "suscripción" sea una feature grande, no un modelo pequeño)

- **Cobro recurrente real** necesita un job (similar a `reintentar-dispersiones.job.js`) que cobre automáticamente vía Wompi (o el proveedor activo) en `proximoCobroAt`, maneje reintentos si falla la tarjeta, y degrade el comercio a plan gratuito si el cobro falla N veces — es una pieza de infraestructura nueva, no solo dos tablas.
- **Beneficios como JSON** (`comisionOverride`, etc.) necesitan que la cascada de comisión de la Capa 1 los consulte como un nivel más (probablemente entre el paso 2 y 3 de la cascada: "¿tiene suscripción activa con override de comisión? úsalo").
- Dado el contexto del proyecto (comunidades del Chocó, alta informalidad, ARQUITECTURA.md documenta que gran parte del público objetivo no tiene ni RUT ni cuenta bancaria verificada), **una suscripción de cobro recurrente por tarjeta probablemente solo tiene sentido para el segmento de comercios ya formalizados/verificados** — no para la base amplia de vendedores informales que la plataforma está diseñada para incluir. Vale la pena decidir el segmento objetivo antes de construir el cobro recurrente.

---

## 4. Empleo — cuatro propuestas concretas para discutir

El punto de partida que no se debe romper: `empleo_publicacion_abierta` (memoria) ya documenta que fue decisión **reafirmada** que cualquier usuario, no solo comerciantes, pueda publicar vacantes gratis, con el riesgo cubierto por moderación + denuncias. Cualquier propuesta de monetización que le ponga fricción a publicar (no a destacar) contradice esa decisión ya tomada.

### Propuesta A — Freemium por destacado
Publicar sigue 100% gratis. Se cobra solo por "destacar" la vacante (aparece primero en el listado, badge visual, X días de vigencia destacada).
- 👍 No toca el pilar social/inclusivo. El que paga es quien tiene urgencia de contratar rápido (normalmente comercios formales), no quien busca trabajo.
- 👎 Ingreso variable e impredecible; requiere pasarela de pago puntual (no recurrente) y UI nueva.

### Propuesta B — Cuota por publicación (con cupo gratis)
X publicaciones gratis al mes por cuenta, luego cobra por publicación adicional.
- 👍 Ingreso más predecible que A si hay comercios con alta rotación de personal.
- 👎 Riesgo real de contradecir la decisión ya tomada de apertura total — un individuo publicando ocasionalmente no debería sentir fricción, y esta propuesta la introduce salvo que el cupo gratis sea generoso.

### Propuesta C — Bundle dentro de la suscripción general (Capa 2)
No se cobra nada directo en Empleo. Publicaciones ilimitadas + destacados incluidos como beneficio de `PlanSuscripcion`, junto con la comisión reducida en los módulos transaccionales.
- 👍 Simplifica la propuesta de valor a un solo plan, un solo cobro.
- 👎 No monetiza a quien **solo** usa Empleo y no tiene actividad transaccional en otro módulo que justifique pagar una suscripción completa (ej. alguien que solo publica "busco niñera" o un pequeño taller que nunca vende en el marketplace).

### Propuesta D — Segmentar por tipo de publicador (mi recomendación como punto de partida)
El modelo ya distingue `tipoPublicacion` (`OFERTA_EMPLEO` vs `OFRECE_SERVICIO`) y si el publicador tiene `comercioId` o no. Propongo:
- **Individuos y `OFRECE_SERVICIO`** (trabajador informal ofreciendo su servicio) → **siempre gratis, sin excepción, para siempre**. Es el corazón social del módulo, el que no se debe tocar.
- **Comercios formales/verificados publicando `OFERTA_EMPLEO`** → aquí sí aplica A o C (destacado de pago, o como parte de su plan de suscripción si ya paga uno).

Esto resuelve directamente la tensión que planteaste: separa lo que es genuinamente comunitario (queda intacto) de lo que ya es actividad comercial formal (donde cobrar no traiciona el propósito del módulo). Es compatible con A o C como mecanismo de cobro — D es el criterio de **a quién** aplicarle cualquiera de los dos, no un mecanismo en sí mismo.

---

## 5. Lo que NO cambiaría bajo ninguna propuesta

- **Bienes Raíces** — sin transacción en plataforma por diseño explícito (riesgo de tierra en disputa, moderación siempre manual con documento obligatorio). No es candidato a comisión ni a freemium por ahora; forzar monetización aquí competiría con el objetivo de seguridad del módulo.
- **Cultura — "Comparte tu Chocó"** — contenido social sin moderación previa, control reactivo por denuncias. Cobrar por publicar contradice directamente su propósito (fomentar participación cultural libre). La boletería de eventos (`EntradaCultural`) sigue en la Capa 1 normal, sin cambios.

---

## 6. Próximos pasos (cuando decidas avanzar)

Esto queda documentado, sin implementar. Cuando quieras retomarlo, lo lógico es:
1. Discutir/ajustar la Propuesta D de Empleo (o elegir A/B/C directamente) — es la pieza con más ambigüedad de negocio.
2. Confirmar si arrancamos por la Capa 1 (comisión unificada — bajo riesgo, mejora inmediata sobre Hotel/Tour/Transporte/Cultura) antes de construir la Capa 2 (suscripción — bastante más grande por el cobro recurrente).
3. Si se aprueba la Capa 2, decidir el segmento objetivo (¿solo comercios verificados? ¿todos?) antes de diseñar el flujo de cobro recurrente con Wompi.

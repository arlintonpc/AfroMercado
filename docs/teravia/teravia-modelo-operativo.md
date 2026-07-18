# Teravia — Modelo Operativo

*Documento de referencia · Julio 2026*
*Complementa: Taxonomía de Ecosistemas*

---

## Propósito

Este documento responde una sola pregunta por cada flujo activo: **¿cómo se mueve un actor por el sistema, desde que entra hasta que genera o recibe valor?**

Cubre únicamente los flujos que ya están **construidos y activos** en la plataforma. Flujos de ecosistemas en Fase 2/3 (ej. Alcaldía/Institucional avanzado) no se documentan aquí todavía — se agregan cuando exista un convenio real que los active.

---

## 1. Flujo — Comprador (Ciudadano)

```
Visita la plataforma
      ↓
Explora productos (sin registro)
      ↓
Se registra (rol COMPRADOR)
      ↓
Agrega al carrito
      ↓
Checkout → Pago (Wompi, pendiente activación producción)
      ↓
Pedido confirmado → Notificación (SSE/Web Push)
      ↓
Seguimiento del pedido
      ↓
Entrega / recepción
      ↓
Calificación (pendiente: módulo de calificación repartidor)
```

**Sistemas involucrados:** Auth, Marketplace, Financiero (pagos), Notificaciones
**Estados del pedido:** creado → confirmado → en preparación → en camino → entregado → calificado
**Gaps identificados:** Favoritos y recomendaciones aún no existen (dependen de Ecosistema IA, Fase 2)

---

## 2. Flujo — Comerciante

```
Se registra (rol COMPRADOR por defecto)
      ↓
Solicita conversión a rol COMERCIANTE
      ↓
Validación por nivel (ver modelo abajo)
      ↓
Sube productos (clasificación LOCAL/NACIONAL obligatoria)
      ↓
Define tiempo de alistamiento (si aplica, ej. borojó)
      ↓
Configura splits_comunidad (si es distribución colectiva)
      ↓
Recibe pedidos
      ↓
Gestiona inventario / stock
      ↓
Recibe pago (vía plataforma, split según comisión)
      ↓
Accede a métricas de comerciante
```

### Modelo de validación por niveles (investigado — julio 2026)

La industria (Rappi, Mercado Libre) exige identidad + RUT como mínimo desde el registro, con ~25% de rechazo por incumplimiento. Pero ese modelo binario excluiría a productores comunitarios sin RUT — justo la población central de la misión de Teravia. Por eso se propone un modelo de **dos niveles** en vez de un único filtro:

| Nivel | Perfil | Requisito de entrada | Qué habilita |
|---|---|---|---|
| **Básico** | Productor/artesano individual sin RUT (ej. comunidades de Chocó) | Identidad (cédula) + aval comunitario (ej. consejo comunitario) como validación alternativa a papeleo formal | Publicar productos, vender, recibir pago vía split |
| **Formal** | Comerciante con RUT constituido | RUT + Cámara de Comercio | Todo lo anterior + facturación DIAN propia si el volumen lo requiere |

**Por qué este modelo:** la evidencia de campo (validada por tu hermano en Chocó) y la investigación sobre informalidad en Colombia coinciden en que la desconfianza institucional y el desconocimiento de trámites son la principal barrera de entrada para productores rurales — un RUT obligatorio desde el día uno reproduciría la exclusión que Teravia busca resolver.

**Sistemas involucrados:** Auth (conversión de rol), Marketplace, Financiero, Panel Admin (aprobación, incluyendo aval comunitario para nivel Básico)
**Punto crítico:** hoy el comerciante puede subir productos, pero **no puede recibir pagos reales** hasta que Wompi esté activo en producción — este flujo está funcionalmente incompleto en el tramo final.
**Gaps identificados:** el mecanismo concreto de "aval comunitario" (¿quién lo registra, cómo se verifica, qué rol tiene tu hermano u otros líderes comunitarios en el panel admin?) no está diseñado todavía — es la siguiente decisión de producto pendiente

---

## 3. Flujo — Pedido Express (Gastronómico)

```
Cliente (COMPRADOR) explora restaurantes/comida
      ↓
Arma pedido
      ↓
Pago (Wompi)
      ↓
Notificación al comercio
      ↓
Comercio prepara (alistamiento)
      ↓
Asignación de repartidor (rol REPARTIDOR, ya validado)
      ↓
Repartidor recoge
      ↓
Tracking en tiempo real (pendiente: GPS real-time, hoy en visión de largo plazo)
      ↓
Entrega
      ↓
Calificación mutua (cliente↔repartidor) — pendiente, en los 131 archivos
```

### Validación de repartidor (flujo previo, investigado — julio 2026)

```
Se registra (rol COMPRADOR por defecto)
      ↓
Solicita conversión a rol REPARTIDOR
      ↓
Verifica: mayoría de edad + identidad (cédula) + RUT como independiente
      ↓
Validación (manual inicial recomendada — la industria movió hacia
verificación presencial tras incidentes de seguridad en 2026)
      ↓
Queda disponible para asignación de pedidos
```

**Referencia de industria:** Rappi exige RUT obligatorio desde el registro (no como trámite posterior) y reporta ~25% de rechazo en su proceso de verificación. Tras incidentes de seguridad recientes, reforzó con verificación presencial para nuevos repartidores.
**Recomendación para Teravia:** dado el volumen inicial bajo, empezar con validación manual vía admin panel (identidad + RUT), sin necesidad de verificación presencial todavía — escalar el rigor cuando el volumen de repartidores lo justifique.

**Sistemas involucrados:** Auth, Marketplace/Express, Financiero, Notificaciones, rol REPARTIDOR, Panel Admin (aprobación)
**Punto crítico:** igual que Comercial, el tramo de pago real está bloqueado hasta activar Wompi
**Gaps identificados:** tracking GPS real-time es roadmap de largo plazo, no construido; calificación de repartidor está en los 131 archivos sin integrar; formulario de validación de repartidor (identidad + RUT) no está diseñado todavía en el panel admin

---

## 4. Flujo — Reserva de Hotel/Tour (Turístico)

```
Operador se registra (rol COMERCIANTE u operador turístico)
      ↓
Aporta número de RNT (Registro Nacional de Turismo)
      ↓
Plataforma valida RNT antes de publicar (requisito legal)
      ↓
Publica alojamiento/tour
      ↓
Ciudadano explora Hoteles/Tours
      ↓
Selecciona fechas/disponibilidad
      ↓
Checkout → Pago (Wompi)
      ↓
Confirmación de reserva
      ↓
Notificación al operador (hotel/tour)
      ↓
Notificación al usuario (confirmación + detalles)
      ↓
Día del servicio → check-in / inicio de tour
      ↓
Calificación / reseña
      ↓
Revalidación de RNT cada 6 meses (requisito legal, ver nota)
```

### ⚠️ Requisito legal identificado (investigado — julio 2026)

El Registro Nacional de Turismo (RNT) es requisito **obligatorio y previo** para operar legalmente como prestador turístico en Colombia. Hay un proyecto de decreto del Ministerio de Comercio en consulta que obligaría explícitamente a las **plataformas digitales** (no solo a los prestadores) a validar el RNT antes de publicar cualquier anuncio y revisarlo cada seis meses. La entrada en vigencia propuesta es 2028, pero conviene que Teravia implemente esta validación desde ahora — refuerza tu diferenciador institucional (B2G) y evita quedar desactualizado frente a la norma.

**Sistemas involucrados:** Auth, Hoteles/Tours, Financiero, Notificaciones, Panel Admin (validación de RNT)
**Punto crítico:** mismo bloqueador de Wompi en producción; adicionalmente, **hoy no existe campo ni validación de RNT** en el módulo de Hoteles/Tours — es un gap legal, no solo funcional
**Gaps identificados:** no hay confirmación de si existe manejo de calendario/disponibilidad en tiempo real o si es manual por parte del operador — confirmar; falta diseñar el campo de RNT y su mecanismo de revalidación semestral

---

## Patrón transversal identificado

**Los 4 flujos comparten el mismo cuello de botella exacto:** todos llegan a un paso de pago que hoy no puede completarse en producción. Esto no es un hallazgo nuevo, pero verlo repetido en los 4 diagramas confirma con evidencia operativa (no solo de negocio) que **Wompi + constitución legal siguen siendo el bloqueador con mayor efecto multiplicador** sobre toda la plataforma.

---

## Pendiente de confirmar (no asumir, verificar contra el código real)

- Manejo de disponibilidad/calendario en Hoteles y Tours (¿tiempo real o gestión manual del operador?)
- Qué pasa operativamente cuando un pedido Express no encuentra repartidor disponible

## Decisiones de producto pendientes (surgidas de la investigación de validación)

1. **Mecanismo de aval comunitario** para comerciantes nivel Básico — quién lo otorga (¿líderes de consejos comunitarios como el de tu hermano?), cómo se registra en el sistema, y qué rol tiene en el panel admin.
2. **Formulario de validación de repartidor** — capturar identidad + RUT, con aprobación manual inicial vía admin panel.
3. **Campo de RNT en Hoteles/Tours** — agregar al modelo de datos, con validación antes de publicar y lógica de revalidación cada 6 meses.

Estas tres piezas son pequeñas en esfuerzo técnico (formularios + campos + lógica de aprobación en el admin panel ya existente), pero requieren decisión de producto antes de codificarlas.

---

## Próxima actualización de este documento

Se agrega un flujo nuevo únicamente cuando ese ecosistema pase de Fase 2/3 a Fase 0/1 en la Taxonomía de Ecosistemas (es decir, cuando tenga código activo, no antes).

# Capítulo 6 — Plan Financiero y Fondeo

*Documento institucional TERAVIA. Versión viva.*
*Última actualización: 2026-07-16.*

## Nota metodológica

Este es el capítulo de cierre del Proyecto Maestro (Capítulos 0-6). Se apoya en hallazgos ya establecidos en capítulos anteriores (requisitos de iNNpulsa en el Capítulo 1, BID Lab y cooperación internacional en el Capítulo 2, riesgo de pagos sin activar en el Capítulo 3, la SAS pendiente en el Capítulo 4) y añade lo que faltaba: modelo de monetización propio, cifras reales de Fondo Emprender —la entidad que el fundador nombró desde el primer mensaje de esta conversación como evaluador objetivo— y una secuencia de fondeo recomendada. Donde no hay datos financieros reales de TERAVIA (ingresos, costos, flujo de caja), se declara como vacío que solo el fundador puede llenar — no se inventan cifras.

---

## 6.1 Modelo de monetización: por qué depender solo de comisión transaccional es un riesgo, no una estrategia

Hoy TERAVIA monetiza únicamente vía comisión transaccional, y solo en el módulo Express, con una tasa fija del 10% hardcodeada en el código (`TASA_COMISION`, documentado en el Capítulo 3). Antes de proponer diversificación, vale comparar esa tarifa contra el mercado real:

| Plataforma | Comisión típica en Colombia |
|---|---|
| Rappi | 20% a 26% del valor de la venta [Fuente: Nautilus] |
| Mercado Libre | 13% a 20% según categoría [Fuente: Wivo Analytics] |
| **TERAVIA (Express, hoy)** | **10%** |

**TERAVIA ya cobra menos que los dos competidores de referencia del país.** Esto no es un error a corregir — es una ventaja competitiva real y ya existente frente a comerciantes que conocen de primera mano lo que cuesta vender en Rappi. Debe comunicarse explícitamente como argumento de adquisición de comerciantes ("la mitad de lo que te cobra Rappi"), no enterrarse como un detalle técnico del código.

**Por qué un solo mecanismo de monetización es insuficiente para un ecosistema de 15 verticales (Capítulo 3):** la comisión transaccional depende enteramente del volumen de ventas, que en el vertical con mayor tracción de TERAVIA (turismo, Capítulo 1) es estacional por naturaleza. Concentrar el ingreso ahí repite, a nivel financiero, el mismo error de concentración que el Capítulo 4 señaló para las relaciones institucionales (dependencia de un solo convenio). Se propone un modelo de tres capas, coherente con lo ya construido y con lo identificado en capítulos anteriores:

1. **Comisión transaccional** (ya existe) — extender el mismo patrón de Express (10%, por debajo del mercado) a Marketplace, Tours y Hoteles de forma consistente, en vez de dejarlo como una regla aislada de un solo módulo.
2. **Suscripción institucional** (no existe hoy) — el segmento identificado en el Capítulo 1 (sección 1.8) como "sin respaldo cuantitativo propio": alcaldías/gobernaciones pagando por vitrina territorial. El módulo de Directorio B2G (Capítulo 3, sección 3.3.3) ya tiene la base técnica; falta el modelo comercial y el mecanismo de continuidad descrito en el Capítulo 4 (sección 4.4) frente a la Ley de Garantías.
3. **Freemium/premium para comerciantes** (no existe hoy) — nivel gratuito con las funciones actuales, nivel de pago con destacados de búsqueda, analítica del propio negocio (conectando con el hallazgo del Capítulo 3 sobre "analítica territorial" como categoría comercial real vendida a negocios, no solo a gobierno), o acceso anticipado a nuevas funciones.

**Por qué esto importa para el fondeo, no solo para el ingreso:** tanto iNNpulsa como Fondo Emprender (secciones 6.2) evalúan la viabilidad financiera del modelo de negocio presentado, no solo el producto. Un plan de monetización de una sola fuente es una debilidad visible en cualquier evaluación seria.

---

## 6.2 Fondeo nacional: Fondo Emprender, con cifras reales

El fundador nombró a Fondo Emprender explícitamente como evaluador objetivo desde el planteamiento inicial de este documento. Estos son los datos verificados, no genéricos:

- **Monto de financiación:** hasta **$780 millones de pesos por proyecto**, escalonado según empleo formal generado — hasta 3 empleos, máximo 80 SMLMV; hasta 5 empleos, máximo 150 SMLMV [Fuente: Infobae/El Tiempo, 2026].
- **Presupuesto disponible en 2026:** más de **$282.000 millones**, distribuidos en 12 convocatorias activas [Fuente: El Tiempo].
- **Aporte obligatorio del emprendedor:** mínimo 10% del valor total del plan de negocio (puede ser en especie, servicios, dinero o aporte industrial) — no es 100% no reembolsable desde el emprendedor, hay coinversión exigida.
- **Requisitos:** ciudadano colombiano mayor de edad, domiciliado en el país, capacidad legal para suscribir contratos, disposición a crear empresa nueva o fortalecer una unidad productiva existente.
- **Proceso:** registro en `fondoemprender.com`, completar la "Ruta Emprendedora" (acompañamiento del SENA para formular el plan de negocio), y postularse a una convocatoria específica con términos de referencia propios.

**Cruce directo con el Capítulo 4:** el requisito de "capacidad legal para suscribir contratos" y la lógica de "crear empresa nueva o fortalecer unidad productiva" presuponen, en la práctica, que exista una figura formal — de nuevo, la constitución de la SAS (Capítulo 4, sección 4.1) es la puerta de entrada, no un trámite paralelo.

**iNNpulsa (Emprendimiento Digital 2026):** ya se estableció en el Capítulo 1 (sección 1.7) el encaje temático y los requisitos generales (RUT, evidencia de funcionamiento, territorios priorizados). **No se encontró en esta investigación un monto específico de capital semilla publicado para esta convocatoria en particular** — se confirma que el modelo es no reembolsable y sin exigencia de equity, combinado con mentoría y conexión con otros actores del ecosistema, pero el monto exacto debe verificarse directamente en `innpulsacolombia.com/convocatorias.html` o `cemprende` al momento de aplicar, ya que las condiciones rotan por convocatoria. Se declara como vacío de información, no se estima.

---

## 6.3 Fondeo internacional: complementario, no primario

Ya establecido en el Capítulo 2 (sección 2.7): **BID Lab** es la única vía de financiamiento internacional identificada con acceso directo a empresas (no solo ONG), con montos de USD 200.000 a 5.000.000 en equity o deuda, y fintech/edtech/govtech/conectividad como sectores prioritarios — TERAVIA encaja temáticamente pero no hay convocatoria específica para Chocó o Colombia rural identificada. AECID, GIZ y la Unión Europea tienen presencia real en el país (y en el territorio piloto), pero sin componente digital explícito hoy — su rol más realista es co-financiación de un componente digital dentro de un proyecto ya en curso (ej. AECID en desarrollo rural/turismo), no una fuente de fondeo nueva independiente.

**Secuencia recomendada:** la cooperación internacional debe tratarse como fondeo de mediano plazo (año 2 en adelante, una vez exista trayectoria formal como empresa), no como parte del cierre de capital inicial.

---

## 6.4 Unit economics: el vacío que solo el fundador puede llenar

Este capítulo no puede producir una proyección financiera real (P&L, flujo de caja, punto de equilibrio) porque **no existen datos financieros reales de TERAVIA disponibles para esta investigación** — la plataforma opera hoy con pagos manuales (Capítulo 3, sección 3.3.2) y sin persona jurídica que consolide cuentas (Capítulo 4). Cualquier cifra de ingresos, costos o proyección que este documento presentara sería inventada, y esto va exactamente en contra del estándar de rigor que se acordó desde el inicio del documento.

**Lo que sí se puede entregar es el marco de seguimiento** (rol de controller financiero, Capítulo "junta de especialistas"), para que el fundador lo llene con datos reales:

| Métrica por vertical | Qué responde |
|---|---|
| GMV (volumen de transacciones) | ¿Cuánto dinero se mueve por el módulo? |
| Ingreso neto de TERAVIA (comisión efectivamente cobrada) | ¿Cuánto de ese GMV se queda la plataforma? |
| Costo de adquisición por comerciante activo | ¿Cuánto cuesta traer y activar un comerciante nuevo? |
| Retención a 90 días | ¿El comerciante sigue vendiendo después del primer mes? |
| Concentración de ingreso (top 10% de comerciantes = qué % del GMV) | ¿Cuánto depende el módulo de pocos actores grandes? |

**Recomendación explícita:** antes del cierre de cualquier ronda de fondeo (Fondo Emprender, iNNpulsa o inversión privada), esta tabla debe estar llena con datos reales de al menos un módulo (Express, el más maduro, Capítulo 3) — un evaluador de Fondo Emprender exige plan de negocio con proyección financiera, y una proyección sin ningún dato histórico real detrás es la debilidad más fácil de detectar en cualquier evaluación seria.

---

## 6.5 Gestión del riesgo de concentración de ingresos

Dos riesgos de concentración ya identificados en capítulos anteriores convergen aquí como riesgo financiero:

1. **Estacionalidad turística** (Capítulo 1): si el vertical de mayor tracción (turismo) también termina siendo la mayor fuente de ingreso, TERAVIA hereda su estacionalidad — meses de temporada baja sin colchón de otra fuente de ingreso.
2. **Dependencia de un solo convenio institucional** (Capítulo 4, sección 4.4): la Ley de Garantías Electorales impone un ciclo de renovación forzado cada 4 años sobre cualquier ingreso por suscripción institucional.

**Mitigación estructural:** el modelo de tres capas de la sección 6.1 (transaccional + institucional + freemium comerciante) no es solo diversificación de producto — es diversificación de **ciclo económico**: comisión transaccional depende de temporada turística/comercial, suscripción institucional depende de ciclo político de 4 años, freemium de comerciante depende de la salud general del tejido empresarial local (Capítulo 1, sección 1.4) — los tres no caen al mismo tiempo por la misma causa.

---

## 6.6 Secuencia de fondeo recomendada

1. **Constituir la SAS** (Capítulo 4, sección 4.1) — 1 a 5 días hábiles, prerrequisito de todo lo demás.
2. **Instrumentar el marco de unit economics** (sección 6.4) sobre el módulo Express con datos reales — necesario antes de cualquier postulación seria.
3. **Postular a Fondo Emprender y/o iNNpulsa Emprendimiento Digital 2026** en paralelo — ambos son fondeo nacional no reembolsable (o con coinversión menor en el caso de Fondo Emprender), la vía más rápida y de menor fricción.
4. **Activar la pasarela de pago real (Wompi)** (Capítulo 3, sección 3.3.2) — en paralelo a los pasos anteriores, no depende de fondeo externo, es una decisión de ejecución interna que reduce riesgo regulatorio y operativo mientras se gestiona el resto.
5. **Explorar BID Lab y co-financiación con AECID/GIZ** — a partir del segundo año, una vez exista trayectoria formal como empresa y datos reales de operación que respalden la conversación.

---

## 6.7 Síntesis del capítulo y cierre del Proyecto Maestro

1. TERAVIA ya cobra comisión por debajo de sus dos referentes de mercado (Rappi, Mercado Libre) — esto es una ventaja competitiva real que debe comunicarse activamente, no un detalle técnico.
2. Depender de una sola fuente de ingreso (comisión transaccional en un solo módulo) hereda los mismos riesgos de concentración ya identificados en gobernanza (Capítulo 4) — la solución es un modelo de tres capas con ciclos económicos independientes entre sí.
3. Fondo Emprender ofrece hasta $780 millones COP por proyecto, con $282.000 millones disponibles en 2026 — es la vía de fondeo nacional más concreta y mejor documentada de todo este Proyecto Maestro, y exige coinversión del 10% y persona jurídica constituida.
4. Este documento no puede ni debe inventar proyecciones financieras sin datos reales — el marco de unit economics de la sección 6.4 es el paso que el fundador debe completar antes de cualquier postulación.
5. La secuencia de fondeo tiene un orden lógico claro: SAS → datos reales de unit economics → fondeo nacional → activación de pagos → fondeo internacional. Ningún paso posterior compensa saltarse el primero.

**Con este capítulo se completa el arco de los seis capítulos del Proyecto Maestro TERAVIA**: quién es (Cap. 0), qué mercado real existe (Cap. 1), en qué territorio real opera (Cap. 2), qué tan construido está de verdad (Cap. 3), cómo se gobierna y se sostiene institucionalmente (Cap. 4), cómo se expande con criterio (Cap. 5), y cómo se financia con honestidad (Cap. 6). Cada capítulo cita sus fuentes y declara explícitamente sus vacíos de información — el estándar que se acordó desde el inicio de esta conversación.

---

## Fuentes citadas en este capítulo

**Comisiones de mercado:** [¿Cuánto cobra Rappi a los restaurantes? — Nautilus](https://nautilusrestaurante.co/que-porcentaje-cobra-rappi-a-los-restaurantes/) · [Cuánto cobra Mercado Libre por venta en 2026 — Wivo Analytics](https://www.wivoanalytics.com/blog/cuanto-cobra-mercado-libre-por-venta-en-2025-guia-completa-de-comisiones-envios-y-mas)

**Fondo Emprender:** [Fondo Emprender del Sena: hasta 780 millones — Infobae](https://www.infobae.com/colombia/2025/03/26/fondo-emprender-del-sena-asi-puede-postularse-y-acceder-a-financiamientos-de-hasta-780-millones-de-pesos/) · [Sena otorgará hasta 100 millones — El Tiempo](https://www.eltiempo.com/cultura/gente/sena-otorgara-hasta-100-millones-de-pesos-para-emprendedores-colombianos-como-aplicar-3538929) · [Fondo Emprender — sitio oficial SENA](https://www.sena.edu.co/es-co/trabajo/Paginas/fondo-emprender.aspx)

**Referencias cruzadas internas:** Capítulo 1 (secciones 1.7 y 1.8) · Capítulo 2 (sección 2.7) · Capítulo 3 (secciones 3.2.1 y 3.3.2) · Capítulo 4 (secciones 4.1 y 4.4).

---

*Anterior: [05 — Estrategia de Expansión Territorial](05-estrategia-expansion-territorial.md) · Fin del Proyecto Maestro (Capítulos 0-6). Próximos pasos de implementación a definir con el fundador.*

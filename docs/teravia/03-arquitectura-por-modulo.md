# Capítulo 3 — Arquitectura del Ecosistema por Módulo

*Documento institucional TERAVIA. Versión viva.*
*Última actualización: 2026-07-16*

## Nota metodológica: por qué este capítulo empieza con una tabla incómoda

El Capítulo 0 (Proyecto Maestro) ya advertía que la lista de 15 componentes declarados mezcla lo construido con la visión, y que "todo evaluador técnico serio la va a pedir; es mejor mostrarla proactivamente que dejar que la descubran." Este capítulo cumple esa promesa: se auditó el código real (no la intención, no el pitch) para cada uno de los 15 módulos, y se investigó mercado real para los que hoy son solo visión. La tabla de la sección 3.1 es el resultado — sin suavizar.

---

## 3.1 Mapa de madurez real del ecosistema

| # | Módulo | Estado real | Nota |
|---|---|---|---|
| 1 | Marketplace de productos | ✅ Construido completo | Flujo íntegro: carrito → checkout → pago → entrega → reseña |
| 2 | Turismo (Tours) | ✅ Construido completo | Reserva, pago, reseña, panel de comerciante |
| 3 | Gastronomía (Express) | ✅ Construido completo | El módulo más maduro del ecosistema — menú con complementos, horarios, crédito de efectivo |
| 4 | Hoteles y hospedajes | ✅ Construido completo | Incluye check-in online por token, temporadas |
| 5 | Productores agropecuarios | ⚠️ **No existe como módulo** | Es solo una categoría de producto dentro del Marketplace (1) — el productor no tiene identidad, flujo ni beneficios propios |
| 6 | Artesanos | ⚠️ **No existe como módulo** | Igual que (5): solo categoría de producto, sin identidad propia |
| 7 | Eventos | ✅ Construido completo, con matiz | Es agenda cultural/patrimonial con boletería (módulo "Cultura"), no un módulo genérico de eventos corporativos |
| 8 | Directorio empresarial | 🟡 Construido parcial | Existe, pero es una vitrina B2G para compra pública ("nunca dinero, factura ni checkout" — así lo etiqueta el propio código), no un directorio empresarial general |
| 9 | Servicios profesionales | ❌ **No existe en absoluto** | Cero rastro en el código |
| 10 | Empleo | ✅ Construido completo | Postulación con hoja de vida, moderación, denuncias |
| 11 | Bienes raíces | ❌ **No existe en absoluto** | Cero rastro en el código |
| 12 | Transporte | 🟡 Construido, con matiz importante | Es transporte fluvial (lanchas, rutas fijas), no un módulo de movilidad general tipo taxi/domicilios de personas |
| 13 | Pagos digitales | 🟡 Código completo, activación no confirmada | La integración con Wompi está completa en código, pero el `.env` no tiene credenciales reales configuradas — hoy la plataforma opera con pagos manuales (transferencia/Nequi/Daviplata con comprobante), no con pasarela activa |
| 14 | Inteligencia Artificial | ❌ **No existe en absoluto** | Cero rastro en el código |
| 15 | Analítica territorial | 🟡 Construido parcial | Existe un panel de reportes admin (ventas por municipio/departamento, cohortes, riesgo), pero no es una plataforma de analítica geoespacial ni predictiva — es un dashboard de BI interno |

**Lectura sin adornos:** de 15 componentes declarados, **6 están construidos de extremo a extremo**, **4 están construidos parcialmente con una brecha real entre lo que dicen ser y lo que hacen**, y **4 no existen en absoluto** más allá de la intención. Esto no es un fracaso — es exactamente lo esperable para una plataforma construida por un equipo reducido en el tiempo que lleva TERAVIA. Pero un documento que presente los 15 como equivalentes pierde credibilidad en la primera revisión técnica seria. Las secciones siguientes tratan cada grupo con el nivel de detalle que le corresponde.

---

## 3.2 Módulos construidos y completos: consolidar antes de expandir

### 3.2.1 Gastronomía (Express) — el módulo de referencia

Es, por evidencia de código, el más maduro del ecosistema: menú con complementos configurables, horarios de apertura, sistema de crédito de efectivo para comercios que operan sin pasarela activa, y — tras el trabajo de rediseño más reciente — un sistema de secciones de menú con vista compacta para ítems de decisión rápida (bebidas) frente a vista de foto grande para platos que requieren "antojo" visual. Este módulo debe tratarse como **el patrón de referencia de UX y arquitectura de datos** para llevar los demás módulos completos al mismo nivel, no como uno más de la lista.

### 3.2.2 Turismo (Tours) y Hoteles — el vertical con mayor respaldo de mercado

El Capítulo 1 ya estableció que el turismo interno colombiano ($23,6 billones/año, +14,8% anual) es el ángulo de mayor tracción. Tours y Hoteles son, junto con Transporte fluvial (3.4), los tres módulos que en conjunto cubren el ciclo completo de un viajero territorial: cómo llega, dónde se queda, qué hace. Esto es una ventaja estructural real — pocos competidores tienen los tres verticales de turismo territorial integrados, y TERAVIA sí.

### 3.2.3 Empleo — el módulo con la conexión institucional más directa y menos explotada

Empleo está completo (postulación, hoja de vida, moderación), pero es también el módulo con más potencial de conexión institucional sin explotar: SENA, cajas de compensación, y programas de formalización laboral (relevante dado el 82,9% de informalidad laboral en zonas rurales dispersas documentado en el Capítulo 2/sección 2.3) son socios naturales que hoy no aparecen en la arquitectura. Esto se retoma en el Capítulo 4 (Gobernanza) como oportunidad de alianza institucional, no de construcción de producto nuevo.

### 3.2.4 Eventos / Cultura — módulo bien construido, pero mal nombrado en la visión

El componente "Eventos" de la lista de 15 en realidad es un módulo de **agenda cultural y patrimonial con boletería** — más cercano a preservación e identidad territorial que a "eventos" en el sentido corporativo (ferias, conferencias). Esto no es un defecto: es coherente con el propósito de TERAVIA. Pero el Capítulo 0 debería renombrar este componente en la lista pública de 15 a algo más preciso ("Cultura y patrimonio territorial") para no generar expectativa de un módulo de eventos genérico que no existe.

---

## 3.3 Módulos parciales: la brecha entre la etiqueta y el código

### 3.3.1 Transporte — fluvial, no genérico (y eso es correcto para el territorio, no un error)

El hallazgo del Capítulo 2 (sección 2.2) explica exactamente por qué el módulo de Transporte se construyó como reserva de rutas fluviales de lancha con horario fijo, y no como un "Uber territorial": en gran parte del Chocó el río *es* la carretera. Este no es un módulo incompleto — es un módulo bien diseñado para la geografía real. Lo que sí falta es la conexión explícita entre este módulo y la logística de última milla del Marketplace/Express (hoy son sistemas separados); resolver esa integración es más valioso que expandir Transporte a un modelo de movilidad urbana que no responde a una necesidad real del territorio piloto.

### 3.3.2 Pagos digitales — el riesgo más operativo del ecosistema hoy

Este es, de los cuatro módulos parciales, el que más urge resolver. El código de integración con Wompi (incluyendo dispersión hacia comercios) está completo, pero sin credenciales reales configuradas en producción, la plataforma opera hoy con pagos manuales verificados por comprobante. Esto tiene dos implicaciones serias:

1. **Operativa:** cada pago manual es fricción y riesgo de fraude/error humano que una pasarela activa eliminaría.
2. **De cumplimiento (conecta directo con el Capítulo 2, sección 2.4):** cuanto más crece el volumen de transacciones en efectivo/manual, más se acerca el operador a los umbrales de la Ley 1581 y a la exposición del tipo de sanción que la SIC ya aplicó a Rappi en 2026 — sin siquiera tener el beneficio operativo de una pasarela activa que automatice la trazabilidad.

**Recomendación de secuencia:** activar Wompi en producción debería tratarse como prioridad de infraestructura, no como una mejora incremental más en la lista de features — es lo que separa a TERAVIA de operar como un directorio con coordinación manual de pagos, de operar como una plataforma transaccional real.

### 3.3.3 Directorio empresarial (B2G) y Analítica territorial — dos productos válidos, mal etiquetados

Ambos existen y funcionan, pero no son lo que su nombre en la lista de 15 sugiere:

- El "Directorio empresarial" es, en código, una vitrina de descubrimiento para compra pública local (B2G) — sin transacción. Es un producto legítimo y potencialmente valioso (conecta con el segmento institucional identificado en el Capítulo 1 como "sin respaldo cuantitativo"), pero no es un directorio empresarial general para que cualquier ciudadano encuentre cualquier negocio.
- La "Analítica territorial" es hoy un panel de reportes de venta por municipio para uso interno/administrativo — no una plataforma de inteligencia territorial vendible a terceros. La investigación de mercado (sección 3.4.5) muestra que sí existe una categoría comercial real de "analítica territorial como servicio" en Colombia (geomarketing), pero orientada a decisiones de expansión de retail privado, no necesariamente a gobiernos — un dato que cambia a quién se le vendería este producto si se decide construirlo de verdad.

---

## 3.4 Módulos de visión: qué dice el mercado real antes de construir

### 3.4.1 Productores agropecuarios — el gobierno ya construyó parte de esto, y no cobra por ello

El hallazgo más importante aquí es competitivo, no de oportunidad: **MinAgricultura ya opera "El Campo a un Clic"**, una vitrina gratuita que integra 15 plataformas de e-commerce agro y ha registrado más de 10.800 usuarios nuevos y 1.053 organizaciones en 10 meses, subsidiando el 50% del costo de transporte. La política "Agricultura por Contrato" ya conectó a 135.000 productores en ventas sin intermediarios por $1,2 billones acumulados. Existen además plataformas privadas (Comproagro, Ofercampo, AgroTracker) sin escala pública verificable.

**Lo que ninguna de estas resuelve, y donde está el espacio real para TERAVIA:** "El Campo a un Clic" es explícitamente una vitrina de contacto — "no participa en la negociación, precios o pagos." Ahí está el hueco: **TERAVIA no debería competir por ser otro directorio de productores, sino ser la capa transaccional que el propio programa gubernamental admite no cubrir** — checkout, pago y logística real, function que el Marketplace de TERAVIA ya construyó para el vertical genérico. La conversación con el productor sería: "el Estado ya te visibiliza gratis, nosotros te vendemos de verdad."

**Vacío de datos, declarado sin rellenar:** no existen cifras oficiales verificables de producción/comercialización de cacao, borojó, chontaduro o coco específicas del Chocó. Esto es en sí mismo un argumento de necesidad (nadie mide el territorio, por eso nadie invierte en él con datos), no un obstáculo para el capítulo.

### 3.4.2 Artesanos — aquí sí hay un competidor consolidado, con oficina en Quibdó

A diferencia del vertical agro, este tiene un competidor real, bien financiado y con presencia territorial directa: **Artesanías de Colombia** (entidad estatal) opera una tienda en línea donde el artesano recibe el 100% del ingreso (sin comisión), con apoyo logístico de envío incluido, más una alianza con Mercado Libre. Tiene un programa específico para artesanía afrocolombiana ("Oficios Artesanales Afrocolombianos", incluye Quibdó) y **una sede regional física en Quibdó** con talleres ya registrados.

**Esto cambia la estrategia de forma directa:** competir de frente contra un canal que no cobra comisión y ya tiene relación territorial establecida es una batalla perdida de antemano. La estrategia razonable es **integración, no competencia** — explorar si los artesanos ya registrados en la sede de Quibdó pueden tener presencia cruzada en TERAVIA (aprovechando su catálogo curado y su verificación de calidad ya hecha por el Estado), en vez de construir un proceso de verificación de artesano desde cero. El sector mueve ~350.000 empleos a nivel nacional y exportaciones crecientes, pero el Chocó **no aparece entre los departamentos exportadores principales** — la oportunidad territorial aquí es más de mercado interno/turístico que de exportación.

### 3.4.3 Bienes raíces — el modelo de "listado" no funciona en el territorio piloto

Este es el hallazgo que más debería frenar cualquier plan de construir este módulo con el modelo obvio (marketplace de listados tipo Fincaraíz). La informalidad de tenencia de tierra rural en Colombia está entre 52% y 60%, y **solo el 6% de los municipios tiene formalidad en más del 75% de sus predios** — el catastro multipropósito cubre apenas 39-40% del territorio nacional, con meta de 70%. Las plataformas inmobiliarias existentes (Fincaraíz, Ciencuadras) están fuertemente concentradas en grandes ciudades, sin presencia documentada en municipios rurales.

**Conclusión honesta:** un marketplace de "publicar y buscar propiedad" no tiene sentido donde la mayoría de los predios no tienen título claro que respalde la publicación. Si este vertical se construye, debería nacer conectado a los procesos de formalización de la Agencia Nacional de Tierras (ANT) — como herramienta de visibilidad para predios *ya formalizados*, no como marketplace abierto — lo cual lo convierte en un módulo de mediano plazo, no de corto plazo, y probablemente dependiente de una alianza institucional con la ANT o el IGAC más que de un desarrollo de producto aislado.

### 3.4.4 Servicios profesionales — el mercado más grande y menos probado de todos

El dato más contundente de todo este capítulo: la informalidad laboral en centros poblados y rural disperso alcanza **82,9%** — 8 de cada 10 trabajadores rurales colombianos están fuera del mercado formal. Es, en tamaño, el vertical de mayor oportunidad teórica de todo el ecosistema. Pero la investigación no encontró ninguna plataforma colombiana de servicios profesionales con relevancia nacional (el espacio lo dominan actores globales como Workana), ni ningún estudio que mida si digitalizar a un trabajador informal territorial efectivamente le genera clientes.

**Esto se declara como lo que es: la mayor oportunidad sin validar del ecosistema.** No hay evidencia de que el modelo funcione en este segmento específico en ningún lado — ni a favor ni en contra. Antes de construir, valdría más un piloto pequeño y medido en un solo municipio que un desarrollo completo de producto.

### 3.4.5 Inteligencia Artificial y Analítica territorial — de buzzword a producto concreto, con un caso de referencia real

Esta era la sección con más riesgo de quedar vacía de contenido real, y la investigación entregó exactamente lo que hacía falta: un patrón de referencia verificable.

**El caso que valida la apuesta por WhatsApp del Capítulo 2:** *AgrodatAi* (marca "Don Tulio") es un chatbot de WhatsApp que da a pequeños agricultores colombianos clima, precios, pronósticos de venta y acceso a créditos/seguros — construido sobre Google Cloud. Creció de 466 usuarios en enero de 2021 a **más de 318.000 agricultores registrados**. Es, con evidencia pública real (no un caso hipotético), la prueba de que "IA aplicada al territorio" no tiene que significar un modelo de lenguaje genérico — puede significar exactamente lo que TERAVIA ya está construyendo como canal (comercio conversacional) con una capa adicional de inteligencia (recomendación de precio, alerta de clima, acceso a crédito).

**Lo que ya existe y TERAVIA no debería reconstruir:** TerriData (DNP) ofrece más de 1.400 indicadores territoriales gratuitos y públicos — cualquier "analítica territorial" que TERAVIA construya debería **integrar esta fuente, no duplicarla**. MinTIC además ya opera "Territorios IA", con 12 modelos de IA entregados a municipios (movilidad, seguridad, contratación pública, variables agrícolas) en 50 municipios piloto — TERAVIA no compite aquí, es un consumidor potencial de esos modelos, no un competidor.

**Lo que sí es un mercado comercial real y sin explotar:** el geomarketing (analítica territorial vendida a empresas para decisiones de expansión) es una categoría comercial establecida en Colombia (GeoMarketing Colombia, Georeferenciar, Belvini), pero la investigación no encontró evidencia de que estas empresas vendan a alcaldías/gobernaciones — su cliente es el retail privado. Esto sugiere que si TERAVIA construye analítica territorial como producto vendible, el comprador más realista en el corto plazo es una marca nacional decidiendo dónde abrir el próximo punto de venta en el Pacífico — no necesariamente la alcaldía, contrario a lo que la Declaración del Proyecto (Capítulo 0) parece asumir.

---

## 3.5 Síntesis: qué hacer con esta información

1. **No se necesitan 15 frentes de desarrollo simultáneos.** El ecosistema ya tiene 6 módulos completos que comparten una base técnica común (Prisma + Next.js + patrón de checkout/reseñas) — consolidar esa base y llevar los 4 módulos parciales a completos genera más valor inmediato que abrir cualquiera de los 4 módulos inexistentes.
2. **Orden de prioridad sugerido para los módulos parciales, por urgencia real:** (1) Pagos digitales — activar Wompi, es riesgo operativo y de cumplimiento acumulándose cada día; (2) integrar Transporte fluvial con la logística de Express/Marketplace; (3) decidir si el Directorio B2G y la Analítica se desarrollan como productos completos o se dejan como están, con expectativa correctamente calibrada en la comunicación pública del proyecto.
3. **De los 4 módulos inexistentes, no todos merecen inversión en el mismo horizonte de tiempo:**
   - **Agro** tiene el caso más claro y de corto plazo: diferenciarse del Estado siendo la capa transaccional que "El Campo a un Clic" admite no cubrir.
   - **Artesanos** debería explorarse como alianza con Artesanías de Colombia antes que como producto propio — competir de frente no tiene sentido económico.
   - **Bienes raíces** es de mediano-largo plazo, dependiente de alianza institucional con ANT/IGAC — construirlo antes como marketplace abierto sería ignorar la realidad de informalidad de tierras documentada.
   - **Servicios profesionales** merece un piloto pequeño y medido, no un desarrollo de producto completo — es la mayor oportunidad teórica pero también la menos validada.
   - **IA** no debería nacer como iniciativa aislada de "agregar IA" — el patrón de referencia (Don Tulio) sugiere que la evolución natural es sobre el canal de WhatsApp ya construido, añadiendo inteligencia de precio/clima/crédito, no un producto nuevo separado. **Analítica territorial** tiene mercado comercial real, pero probablemente con retail privado como comprador antes que con gobierno.

---

## Fuentes citadas en este capítulo

**Agro:** [El Campo a Un Clic — MinAgricultura](https://www.minagricultura.gov.co/Paginas/El-campo-a-un-clic.aspx) · [135.000 productores sin intermediarios — AgroNET](https://agronet.gov.co/noticias/ya-son-135000-productores-que-vendieron-sus-cosechas-sin-intermediarios-con-agricultura) · [Directorio de Abastecimiento Nacional — ADR](https://www.adr.gov.co/pequenos-productores-y-organizaciones-ya-pueden-inscribirse-en-el-directorio-de-abastecimiento-nacional-de-la-agencia-de-desarrollo-rural/)

**Artesanías:** [Tienda Artesanías de Colombia](https://artesaniasdecolombiatienda.com.co/) · [Alianza Mercado Libre — MinCIT](https://www.mincit.gov.co/prensa/noticias/industria/artesanias-colombianas-en-mercado-libre) · [Sede Chocó — Artesanías de Colombia](https://artesaniasdecolombia.com.co/PortalAC/C_sector/choco_5326) · [Oficios Artesanales Afrocolombianos](https://artesaniasdecolombia.com.co/PortalAC/Noticia/oficios-artesanales-afrocolombianos_14776)

**Bienes raíces:** [UPRA — Informalidad de tenencia de tierra](https://upra.gov.co/es-co/node/1062) · [IGAC — avance catastro multipropósito 2025](https://www.igac.gov.co/noticias/colombia-avanza-en-la-implementacion-del-catastro-multiproposito-268-del-territorio-nacional-actualizado-es-la-cifra-que-reporta-el-igac-para-2025) · [Fincaraíz/Ciencuadras concentración urbana — La República](https://www.larepublica.co/empresas/fincaraiz-y-ciencuadras-las-plataformas-que-lideran-la-oferta-de-vivienda-en-arriendo-3187770)

**Servicios profesionales:** [DANE — informalidad rural disperso 82,9%](https://www.eltiempo.com/colombia/dane-publicara-las-nuevas-cifras-de-informalidad-laboral-de-marzo-mayo-de-2026-sincelejo-mantiene-la-tasa-mas-alta-del-pais-desde-el-ultimo-reporte-3569404) · [Workana Colombia](https://www.workana.com/en/jobs?country=CO)

**IA y analítica territorial:** [TerriData — DNP](https://terridata.dnp.gov.co/) · [Territorios IA — MinTIC](https://www.esmartcity.es/2024/11/19/iniciativa-territorios-ia-colombia-acelera-transformacion-digital-municipios) · [AgrodatAi / Don Tulio — El Colombiano](https://www.elcolombiano.com/negocios/empresas/agrodatai-la-empresa-que-usa-la-inteligencia-artificial-en-pro-del-agro-colombiano-CA21561210) · [AgrodatAi — Google Cloud case study](https://cloud.google.com/customers/agrodatai) · [GeoMarketing Colombia](https://geomarketing.co/)

**Auditoría de código:** inspección directa de `afromercado/prisma/schema.prisma`, `afromercado/src/routes/index.js`, `afromercado/src/services/`, `afromercado/src/controllers/`, `afromercado-web/app/` — realizada el 2026-07-16.

---

*Anterior: [02 — Realidad Territorial y Marco Institucional](02-realidad-territorial.md) · Siguiente: 04 — Gobernanza, Marca y Sostenibilidad Institucional (pendiente)*

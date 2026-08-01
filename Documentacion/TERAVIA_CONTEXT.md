# TERAVIA CONTEXT: Fuente Única de Verdad

> **Regla de Oro:** Todo agente de IA o desarrollador debe leer este documento antes de escribir una sola línea de código o proponer una arquitectura. Teravia no desarrolla funcionalidades por moda; desarrolla oportunidades para los territorios. Toda mejora debe justificar cómo fortalece esta visión.

---

## 1. Visión del Proyecto
**De una plataforma transaccional a un ecosistema territorial.**
Teravia no busca responder únicamente a la pregunta *"¿qué puedo comprar?"*, sino *"¿cómo puedo aportar y conectar dentro de mi territorio?"*. El objetivo es que las conexiones sean visibles: si alguien reserva un hotel, debe saber de qué productor local vienen los insumos, qué artesanos están cerca y qué guías locales puede conocer. 

Teravia conecta **identidad, relaciones y futuro económico**, transformando módulos aislados en un ecosistema vivo.

## 2. Filosofía y Propuesta de Valor
* **Menos tecnología, más personas:** No somos un "Marketplace territorial", somos el espacio donde *"encuentras a las personas que hacen posible este territorio"*.
* **El Territorio como Protagonista:** Cada municipio tiene su propio perfil dinámico. Se destaca lo que produce, lo que ofrece, sus eventos y sus emprendimientos. El usuario debe sentir que está entrando a un lugar real, no a una aplicación.
* **Ecosistema Interconectado:** Las transacciones no son el fin, son el medio para generar desarrollo y visibilizar la cadena de valor local.

## 3. Arquitectura Funcional y Módulos Core
Teravia se compone de múltiples módulos que interactúan entre sí. A nivel de evolución comunitaria, se estructura bajo el concepto de **"Construyendo Teravia"**:

1. **Centro de Ideas:** El espacio donde los usuarios proponen mejoras o nuevas funciones para su territorio y la plataforma.
2. **Comunidad y Comentarios:** Foros de debate para enriquecer y madurar las propuestas locales.
3. **Roadmap Público:** Visualización transparente de lo que se está construyendo, lo que viene y lo que ya se logró.
4. **Sistema de Reconocimiento:** Gamificación y recompensas para los usuarios (ciudadanos, productores, comerciantes) que más aportan a la evolución del ecosistema.
5. **Perfiles de Territorio (Municipios):** Landing pages dinámicas por municipio resaltando su red de comercio, turismo y cultura.

## 4. Escuadrón de Inteligencia Artificial (IA)
Para que el ecosistema evolucione de manera inteligente, Teravia cuenta con un equipo de agentes IA especializados que operan en segundo plano:

* **Agente Analista de Patrones (Agrupador):** Lee, limpia y agrupa sugerencias y comportamientos para evitar duplicados y detectar tendencias de lo que más piden los usuarios.
* **Agente de Impacto:** Evalúa y mide el impacto potencial de una idea o iniciativa en el negocio y en la comunidad local.
* **Agente Priorizador:** Ordena el backlog de ideas basándose en la viabilidad técnica, el impacto territorial y el respaldo (votos) de la comunidad.
* **Agente CPO (Chief Product Officer):** El orquestador. Toma la información procesada por los demás agentes y la traduce en "Decisiones de Producto", definiendo tareas accionables y actualizando el Roadmap Público.

## 5. Principios de Experiencia de Usuario (UX) e Identidad
* **Navegación Relacional:** En cada pantalla de detalle (producto, hotel, tour) se deben sugerir "Nodos conectados" (ej. "Conoce al agricultor que cultiva esto" o "Artesanos cerca de este hotel").
* **Identidad Visual Cálida y Auténtica:** Uso de colores de marca, tipografías modernas (Inter/Outfit) y fotografías de alta calidad que resalten la estética de la región (aspect ratios panorámicos para no abrumar en móvil).
* **Fricción Cero:** Interfaces rápidas, filtros intuitivos (como autocompletado por municipio) y claridad absoluta.

## 6. Reglas de Negocio y Desarrollo
1. **Mantener la Arquitectura:** Cualquier nuevo módulo debe integrarse al ecosistema relacional (Base de datos centralizada con Prisma) sin generar silos de información.
2. **Priorizar lo Local:** Los algoritmos de búsqueda y recomendación deben dar peso a la cercanía y al impacto en la red local.
3. **Validación:** Todo agente que proponga un cambio de código debe justificarlo bajo los principios de este documento.

---
*Este documento es la base (Context). A partir de aquí, en la carpeta `Documentacion/`, vivirán los documentos detallados adicionales y los archivos específicos por módulo.*

# CODEX.md - Contexto Maestro De AfroMercado / Teravia

Ultima verificacion: 2026-07-25
Commit verificado: `1dda5fc`
Rama principal: `main`

## 1. Proposito De Este Archivo

Este documento es la guia viva de contexto para analizar, corregir, automatizar,
evolucionar y extender el proyecto. No reemplaza el codigo ni el esquema de
datos. Su funcion es evitar que una iniciativa empiece con supuestos viejos o
que una propuesta se confunda con una funcionalidad implementada.

Reglas de mantenimiento:

- Actualizar la fecha y la linea base despues de cambios estructurales.
- Marcar cada iniciativa como `PROPUESTA`, `APROBADA`, `EN CURSO`,
  `EN REVISION`, `VERIFICADA` o `BLOQUEADA`.
- No declarar una funcionalidad terminada solo porque compila.
- Citar archivos, pruebas, commits o endpoints cuando se registre un hecho.
- Separar siempre: estado actual, deuda conocida y propuesta futura.

## 2. Jerarquia De Fuentes

Cuando dos documentos se contradigan, usar este orden:

1. Comportamiento verificado en codigo, pruebas y base de datos.
2. `afromercado/prisma/schema.prisma` para el contrato del Prisma Client.
3. DDL activa en `afromercado/src/utils/migrador.js` para produccion.
4. `AGENTS.md` y los `AGENTS.md` anidados para reglas operativas.
5. Este archivo como mapa consolidado.
6. `Documentacion/DebateTecnico/MESA_DE_DIALOGO_Y_CONSENSO.md` para
   decisiones y propuestas.
7. Auditorias y documentos historicos, que pueden estar desactualizados.

No asumir que una afirmacion en una auditoria sigue vigente. Verificarla con
`rg`, pruebas y, cuando corresponda, un endpoint o una base de datos real.

## 3. Identidad Y Objetivo Del Producto

Nombre historico del repositorio: AfroMercado.
Marca visible actual: Teravia.

Teravia es una plataforma multiservicio territorial nacida en el Choco para
conectar comunidades afrocolombianas, indigenas, campesinas, comercios,
productores, viajeros, compradores, instituciones y repartidores.

El producto combina:

- Marketplace de productos fisicos.
- Express para comida y comercio de entrega rapida.
- Hoteles y alojamientos.
- Tours y experiencias.
- Transporte fluvial y terrestre.
- Cultura, eventos, vitrina social, reels e historias comerciales.
- Empleo y perfiles laborales.
- Bienes raices con moderacion documental.
- Directorios territoriales y compras publicas.
- Publicidad, cupones, fidelizacion, alianzas y reporteria.
- Pagos, dispersiones, facturacion, disputas y liquidaciones.

## 4. Linea Base Verificada

Inventario tecnico al 2026-07-25:

- 95 modelos Prisma.
- 62 enums Prisma.
- 43 archivos de rutas backend.
- 569 declaraciones de endpoints Express.
- 42 controladores, 41 servicios y 21 repositorios.
- 140 archivos `page.tsx`.
- 19 archivos de pruebas backend, incluidos 3 scripts E2E.
- Next.js 16.2.9, React 19.2.4 y TypeScript 5.
- Express 4, Prisma 5.22 y PostgreSQL/Neon.

Validacion ejecutada:

- Backend `npm run lint`: aprobado, pero solo ejecuta `node --check` sobre
  `src/server.js` y `src/app.js`; no es un lint completo.
- Backend `npm run test:vitest`: 39/39 pruebas aprobadas en 5 suites.
- Backend `npm test`: 157/157 pruebas legacy aprobadas.
- Frontend `npm run lint`: 0 errores y 295 advertencias.
- Frontend `npx tsc --noEmit`: aprobado.
- Frontend `npm run build`: aprobado; 128 paginas generadas.
- E2E no se ejecuto en esta linea base porque requiere API y base de datos
  locales preparadas.

La existencia de advertencias no bloquea CI actualmente. Las advertencias se
deben reducir por dominio, sin una reescritura masiva.

## 5. Estructura Del Repositorio

```text
D:\AfroMercado
|- afromercado/                 API Express, Prisma, jobs y pruebas
|- afromercado-web/             Next.js App Router y PWA
|- Documentacion/               Decisiones, implementaciones y mesa tecnica
|- docs/teravia/                Vision, estrategia y auditorias de producto
|- .github/workflows/ci.yml     CI de backend y frontend
|- AGENTS.md                    Reglas principales de trabajo
|- CODEX.md                     Este contexto maestro
```

Backend:

```text
routes -> controllers -> services -> repositories -> Prisma/PostgreSQL
```

La separacion por capas es la direccion preferida, pero algunos modulos
antiguos consultan Prisma directamente desde servicios o controladores. No
ampliar esa desviacion sin una razon concreta.

Frontend:

```text
app/ -> components/ -> lib/api/ -> API Express
                    -> context/ y hooks/
```

La mayoria de pantallas interactivas son Client Components. React Query ya
existe, pero su adopcion es parcial; tambien hay carga manual, polling y SSE.

## 6. Backend: Nucleo Tecnico

Puntos de entrada:

- `afromercado/src/server.js`: Sentry, migraciones seguras, servidor, cron y
  jobs.
- `afromercado/src/app.js`: CORS, Helmet, cookies, body parsing, uploads,
  rate limits, rutas y errores.
- `afromercado/src/routes/index.js`: montaje de dominios bajo `/api`.
- `afromercado/src/config/index.js`: variables obligatorias y degradables.
- `afromercado/src/middlewares/auth.js`: autenticacion y autorizacion.

Roles actuales:

- `COMPRADOR`
- `COMERCIANTE`
- `ADMIN`
- `REPARTIDOR`

Autenticacion:

- JWT firmado con `JWT_SECRET`.
- Cookie `afromercado_token` HttpOnly.
- En produccion: `Secure` y `SameSite=None` porque Vercel y Render son
  cross-site.
- Se conserva compatibilidad con `Authorization: Bearer`.
- `?token=` existe para flujos SSE/EventSource.
- El middleware vuelve a consultar el usuario y rechaza cuentas inactivas o
  sesiones anteriores a un cambio de contrasena.

Seguridad de red:

- `CORS_ORIGIN` es obligatorio en produccion.
- Rate limit general, de autenticacion y recuperacion.
- Los limites solo se activan con `NODE_ENV=production`.
- Helmet esta activo.
- Los errores 500 pueden enviarse a Sentry si esta configurado.

## 7. Datos Y Migraciones

Base de datos de produccion: PostgreSQL en Neon.

Hay dos mecanismos que deben mantenerse sincronizados:

- `prisma/schema.prisma`: contrato de modelos y tipos del Prisma Client.
- `src/utils/migrador.js`: DDL idempotente ejecutada al arrancar.

El migrador:

- Usa advisory lock para evitar ejecuciones simultaneas.
- Registra hash, SQL, resultado y error en `_MigracionLog`.
- Puede omitir auto-migracion con `SKIP_AUTO_MIGRATIONS=true`.
- Puede fallar el arranque con `STRICT_MIGRATION_MODE=true`.

Reglas para cambios de esquema:

- Disenar primero la compatibilidad hacia atras.
- Agregar DDL idempotente y su equivalente en Prisma.
- Regenerar Prisma Client con el backend detenido en Windows.
- Probar un arranque repetido: la segunda ejecucion no debe alterar datos.
- No eliminar tablas o columnas en la misma fase que introduce el reemplazo.
- No usar `prisma migrate deploy` en produccion sin una decision explicita de
  infraestructura; las instrucciones operativas actuales priorizan el
  migrador seguro.
- Los `Decimal` de Prisma llegan como strings en JSON. Convertir con
  `Number()` antes de operar.

Riesgo abierto de alta prioridad:

- `HistoriaEfimera` y `VistaHistoriaEfimera` tienen `@@map` hacia tablas
  snake_case activas.
- El migrador tambien contiene DDL para tablas PascalCase y copia datos desde
  las tablas snake_case.
- No cambiar los `@@map`, borrar tablas ni adoptar las tablas PascalCase sin
  una migracion de datos explicitamente aprobada y verificada.

## 8. Marketplace, Stock Y Pagos

Modelos centrales:

- `Producto`
- `CarritoItem`
- `Pedido`
- `SubPedido`
- `PedidoItem`
- `Pago`
- `PagoDispersion`
- `Entrega`
- `Liquidacion`
- `Disputa`
- `FacturaElectronica`

Semantica actual del inventario:

- `Producto.stock`: existencia fisica reconocida por el sistema.
- `Producto.stockReservado`: unidades apartadas por pedidos aun no
  confirmados.
- Disponible: `stock - stockReservado`.
- `stockMinimo`: umbral de alerta.
- La creacion del pedido reserva stock con un `UPDATE` condicional dentro de
  una transaccion.
- La confirmacion del pago descuenta `stock` y libera `stockReservado`.
- Pago fallido, cancelacion o expiracion liberan la reserva.
- La confirmacion de pago es idempotente y tiene pruebas especificas.

No actualizar stock desde un modulo nuevo sin respetar estas invariantes.

Pagos:

- Proveedor abstraido con implementaciones `SANDBOX` y `WOMPI`.
- El checkout requiere `idempotencyKey`.
- El webhook valida monto y duplicidad de evento.
- Las dispersiones se crean por subpedido/comercio.
- Los reintentos de dispersion y facturacion corren como jobs.
- Facturacion y puntos de fidelizacion se disparan despues de confirmar.

Una nueva contabilidad no debe duplicar ventas ni ser fuente de verdad del
pago. Debe leer ventas confirmadas y registrar costos/movimientos asociados.

## 9. Verticales Y Estado Funcional

| Dominio | Estado verificado en codigo | Fuente principal |
|---|---|---|
| Marketplace | Implementado | Pedido, pago, producto, carrito |
| Express | Implementado | ConfigExpress, PedidoExpress, Producto compartido |
| Hoteles | Implementado | ConfigHotel, HabitacionTipo/Fisica, ReservaHotel |
| Tours | Implementado | ConfigTour, TourLugar, ReservaTour |
| Transporte | Implementado | ConfigTransporte, Ruta, ReservaTransporte |
| Cultura | Implementado | Eventos, entradas, reservas, publicaciones |
| Vitrina/Reels | Implementado | PublicacionCultural y UI de teatro/reels |
| Historias comerciales | Implementado con deuda DDL | HistoriaEfimera |
| Empleo | Implementado | Oferta, hoja de vida, postulacion, denuncias |
| Bienes raices | Implementado con moderacion | Inmueble y soporte documental |
| Publicidad/AfroMedia | Implementado | Solicitudes, paquetes, metricas, auditoria |
| Reporteria | Implementada | ReporteRepository y exportacion Excel |
| Contabilidad operativa | Aprobada, no implementada | Mesa 11, Fase 1 |

No todas las verticales usan exactamente el mismo ciclo de pago, resenas,
favoritos o cupones. Antes de "unificar" comprobar si la diferencia responde
a negocio real o a duplicacion accidental.

## 10. Frontend

Base:

- Next.js App Router 16.
- React 19.
- Tailwind CSS 4.
- React Query disponible.
- PWA con manifest, service worker y pagina offline.
- Leaflet para mapas.
- Recharts para analitica.
- Sentry para observabilidad.

Contextos globales actuales:

- Auth
- Region
- Push
- Notificaciones
- Favoritos
- Carrito
- QueryProvider

La anidacion global y el polling frecuente pueden afectar rendimiento. Medir
antes de introducir mas providers o intervalos.

Cliente HTTP:

- `lib/api/client.ts` centraliza `API_URL`, cookies, bearer de compatibilidad,
  JSON, FormData y expiracion de sesion.
- Toda API nueva debe tener funciones tipadas en `lib/api/`.
- No hacer `fetch` directo desde una pagina si existe o puede crearse una
  funcion de dominio reutilizable.

Media:

- `normalizarUrlMedia` convierte rutas `/uploads/...` a URL del backend.
- Cloudinary es la ruta preferida en produccion.
- Sin Cloudinary hay fallback a archivos locales; en despliegues efimeros este
  almacenamiento no es persistente.
- Next 16 puede rechazar la optimizacion SSR de imagenes de
  `http://localhost:3001` por resolver a IP privada, aunque exista
  `remotePatterns`. Tratarlo como problema de desarrollo/local media, no como
  error del endpoint.

Diseno:

- Marca: verde oscuro `#1B4332`, verde medio `#2D6A4F`, crema `#F7F5F2` y
  dorado `#D4A017`.
- Tipografias actuales: Inter y DM Serif Display.
- Conservar el lenguaje visual territorial de Teravia.
- Verificar siempre escritorio y movil.

Regla especial de Next.js:

- Consultar `afromercado-web/node_modules/next/dist/docs/` antes de usar APIs
  de Next, porque la version 16 tiene cambios incompatibles con guias viejas.

## 11. Tiempo Real Y Procesos En Segundo Plano

Tiempo real:

- SSE central para notificaciones.
- Eventos de ubicacion de repartidor.
- Algunas pantallas combinan SSE con polling de respaldo.

Jobs:

- Expiracion y recordatorio de pedidos.
- Alertas de repartidor.
- Carritos abandonados.
- Expiracion de pedidos Express.
- Expiracion de reservas de Hotel.
- Recordatorios de Tour.
- Reintentos de dispersion.
- Reintentos de facturacion.

Los jobs usan `setInterval` dentro del proceso web. En multiples replicas cada
replica podria ejecutar el mismo job. Toda automatizacion financiera nueva
debe ser idempotente y, si escala a varias replicas, usar lock distribuido o
una cola.

## 12. Variables Y Servicios Externos

Obligatorias o criticas:

- `DATABASE_URL`
- `DIRECT_URL` cuando corresponda a operaciones directas
- `JWT_SECRET`
- `CORS_ORIGIN` en produccion
- `FRONTEND_URL`
- `NEXT_PUBLIC_API_URL`

Servicios degradables:

- Cloudinary
- Sentry
- SMTP o Resend
- VAPID Web Push
- Anthropic para asistente de WhatsApp

Pagos Wompi requieren configuracion adicional de checkout, eventos y
dispersiones. Nunca registrar valores secretos en documentos, commits, logs o
respuestas.

Puertos locales:

- Backend esperado por el proyecto: `3001`.
- Frontend: `3002`.
- `config/index.js` usa `3000` como fallback; el `.env` local debe definir
  `PORT=3001` para coincidir con el frontend y `iniciar.bat`.

## 13. Desarrollo, CI Y Despliegue

Inicio local en Windows:

```bat
iniciar.bat
```

El script mata todos los procesos `node.exe`, regenera Prisma y abre backend y
frontend. Usarlo con cuidado si hay otros proyectos Node ejecutandose.

Backend:

```powershell
cd D:\AfroMercado\afromercado
npm.cmd run dev
npm.cmd run lint
npm.cmd run test:vitest
npm.cmd test
npm.cmd run test:e2e
```

Frontend:

```powershell
cd D:\AfroMercado\afromercado-web
npm.cmd run dev
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

CI en GitHub:

- Backend: install, Prisma generate, lint superficial, Vitest y legacy tests.
- Frontend: install, ESLint, typecheck y build.
- Los E2E no corren en CI.
- No hay una prueba de migracion contra PostgreSQL real en CI.

Despliegue:

- Frontend: Vercel.
- Backend: Render.
- Base de datos: Neon.
- Media: Cloudinary, con fallback local.
- El frontend de produccion usa el backend de Render a traves de
  `NEXT_PUBLIC_API_URL`.

## 14. Riesgos Y Deuda Priorizada

Alta:

1. La politica contable de cupones no esta reconciliada de extremo a extremo.
   Falta definir financiador, asignacion por subpedido, GMV y momento de consumo
   antes de calcular margen o modificar dispersiones.
2. El proyecto no conserva un backup propio ni una prueba periodica de
   restauracion. Las DDL se ejecutan al arrancar, sentencia por sentencia, por
   lo que una falla parcial exige una estrategia de recuperacion demostrable.
3. Resolver de forma explicita la duplicacion DDL de historias antes de tocar
   sus nombres de tabla.
4. Mantener atomicidad e idempotencia al introducir Kardex y costos.
5. Agregar pruebas de migracion y E2E con PostgreSQL real.

Verificado tecnicamente en el arbol de trabajo, pendiente de commit:

- Propiedad de instrucciones de pago.
- Aislamiento y carreras de idempotencia manual y digital.
- Serializacion entre pago, cancelacion, aprobacion y rechazo.
- Webhooks tardios, reintentos no procesados e identificadores contradictorios.
- Reclamo temporal de dispersiones para evitar dobles envios entre replicas.
- Claves idempotentes de dispersion por intento, envio individual y detencion
  automatica cuando la respuesta de Wompi es incierta.
- Escritura atomica y serializada de `PrecioHistorial`.
- Duplicacion de totales en el ROI de cupones.

Evidencia:

- Auditoria independiente final: sin bloqueadores altos ni criticos.
- QA independiente: aprobado.
- Vitest completo: 50/50.
- Pruebas focalizadas finales de Fase 0: 23/23.
- Suite heredada: 157/157.
- Locks y lease verificados de forma no destructiva contra PostgreSQL.
- Pendiente no bloqueante: E2E HTTP y sandbox real de Wompi.

Media:

1. El lint backend no cubre el arbol completo.
2. El frontend acumula 295 advertencias.
3. React Query convive con muchos fetch manuales y polling.
4. Los documentos historicos contienen estados y cifras obsoletas.
5. El fallback local de uploads no es persistente en Render.
6. Hay modulos grandes en una sola pagina, especialmente paneles de servicios.

Baja o evolutiva:

1. Reducir `any`, imports sin uso y dependencias faltantes en hooks.
2. Mejorar rendimiento de imagenes no optimizadas.
3. Dividir pantallas monoliticas sin cambiar comportamiento.
4. Consolidar patrones de carga, error, vacio y confirmacion.

Pruebas de cierre obligatorias para dinero e inventario:

- Un usuario no puede consultar instrucciones de pago de otro pedido.
- Una clave de idempotencia no puede cruzar usuarios ni pedidos.
- Un webhook tardio no puede confirmar un pedido cancelado ni descontar dos
  veces el stock.
- Un cupon aplicado a varios comercios reconcilia total cobrado, descuentos,
  comision, netos y reportes sin diferencias.
- Un cambio de precio deja evidencia historica verificable.
- Una migracion interrumpida puede reintentarse y restaurarse sin perdida.

## 15. Iniciativa Activa: Contabilidad Operativa E Inventario

Estado: Fase 1 `APROBADA`, pero su inicio permanece condicionado al cierre de
la Fase 0 financiera y a la decision de politica de cupones.

Documento ejecutable:

- `Documentacion/DebateTecnico/implementation_plan.md`

Alcance aprobado:

- Costo unitario vigente.
- Proveedores y compras manuales.
- Recepcion de compra.
- Movimientos de compra, ajuste, merma, devolucion y venta.
- Costo promedio.
- Resumen de ventas, costo estimado, margen e inventario.
- Reportes operativos.

Fuera de alcance de Fase 1:

- Contabilidad legal.
- Libro diario y balance formal.
- Impuestos y retenciones.
- Conciliacion bancaria.
- Cambios a Wompi o dispersiones.
- PEPS, bodegas multiples y variantes.

Invariantes obligatorias:

- Ventas provienen de pedidos/subpedidos confirmados; no se duplican.
- Una recepcion de compra debe ser idempotente.
- Ningun movimiento puede dejar stock negativo.
- Los movimientos no se borran; se compensan.
- Todo dato debe estar aislado por `comercioId`.
- El Kardex debe integrarse con la confirmacion y liberacion de stock actual.

Preparacion ya realizada:

- Arquitectura de datos y contratos API propuesta por un agente especializado.
- Matriz QA funcional, de seguridad, regresion e idempotencia propuesta por un
  agente independiente.
- Auditoria de pagos, stock, cupones, precios y recuperacion incorporada a los
  riesgos de este documento.
- Estas propuestas son insumos de revision; no equivalen a implementacion ni
  deben integrarse sin validacion de Codex y aprobacion del dueno del producto.

Roles de la mesa:

- Dueno del producto: aprueba alcance y cierres.
- Gemini: producto, UX y criterios visibles.
- Claude: datos, migraciones, seguridad y concurrencia.
- Codex: coordinacion, integracion, implementacion y verificacion.
- Auditor independiente: busca regresiones y diferencias con el acuerdo.
- QA independiente: ejecuta pruebas de cada fase.

## 16. Protocolo Para Cambios Nuevos

Antes de editar:

1. Leer este archivo y el `AGENTS.md` aplicable.
2. Revisar `git status` y cambios de otros agentes.
3. Localizar la fuente de verdad del dominio.
4. Escribir alcance, exclusiones, riesgos y criterio de cierre.
5. Si afecta dinero, inventario, datos personales o despliegue, confirmar la
   aprobacion del dueno del producto.

Durante la implementacion:

1. Cambios pequenos y por dominio.
2. No mezclar correcciones ajenas en el mismo commit.
3. Proteger permisos por rol y propiedad.
4. Mantener compatibilidad de API y datos.
5. Agregar pruebas antes de marcar cierre.
6. Registrar decisiones relevantes en la mesa.

Validacion minima:

- Lint o sintaxis del dominio.
- Pruebas unitarias del cambio.
- Suite de regresion relevante.
- TypeScript y build para frontend.
- Prueba API real cuando cambie DDL o persistencia.
- Prueba visual escritorio/movil cuando cambie UI.
- Revision independiente cuando afecte dinero o stock.

Definicion de terminado:

- Implementado.
- Probado.
- Revisado por otro rol.
- Evidencia registrada.
- Documentacion actualizada.
- Sin contradicciones entre Prisma, DDL, API y UI.

## 17. Archivos Criticos

Datos y arranque:

- `afromercado/prisma/schema.prisma`
- `afromercado/src/utils/migrador.js`
- `afromercado/src/server.js`
- `afromercado/src/app.js`

Dinero e inventario:

- `afromercado/src/services/pedido.service.js`
- `afromercado/src/services/pago-digital.service.js`
- `afromercado/src/services/liquidacion.service.js`
- `afromercado/src/services/disputa.service.js`
- `afromercado/src/services/facturacion.service.js`
- `afromercado/src/repositories/reporte.repository.js`

Autenticacion:

- `afromercado/src/middlewares/auth.js`
- `afromercado/src/services/auth.service.js`
- `afromercado/src/controllers/auth.controller.js`

Frontend base:

- `afromercado-web/app/layout.tsx`
- `afromercado-web/components/Providers.tsx`
- `afromercado-web/context/AuthContext.tsx`
- `afromercado-web/lib/api/client.ts`
- `afromercado-web/next.config.ts`

Gobernanza:

- `AGENTS.md`
- `Documentacion/DebateTecnico/MESA_DE_DIALOGO_Y_CONSENSO.md`
- `Documentacion/DebateTecnico/implementation_plan.md`

## 18. Preguntas Que Deben Permanecer Visibles

- Que partes de una nueva iniciativa son fuente de verdad y cuales son
  proyecciones calculadas?
- El flujo es idempotente frente a reintentos, webhooks y multiples replicas?
- Que ocurre con stock reservado, devoluciones, cancelaciones y disputas?
- Se conserva el aislamiento entre comercios?
- La migracion puede ejecutarse dos veces sin perder ni duplicar datos?
- La UI comunica estados parciales y errores recuperables?
- La prueba uso mocks solamente o tambien una persistencia real?
- El documento dice "implementado" porque hay evidencia o solo porque fue
  propuesto?

# Implementacion de pagos marketplace y dispersion automatica

Fecha: 2026-06-26

## Decision implementada

AfroMercado queda preparado para operar pagos 100% digitales por pasarela, sin comprobantes manuales en la experiencia principal.

El modelo implementado separa:

- Cobro al comprador.
- Confirmacion oficial por webhook de pasarela.
- Cuenta de dispersion del comerciante.
- Calculo de comision de AfroMercado.
- Dispersion del neto por cada subpedido/comerciante.

En produccion, los pagos manuales quedan deshabilitados por defecto. Solo se mantienen como compatibilidad de desarrollo o pruebas si se activa `PAGOS_MANUALES_HABILITADOS=true`.

## Archivos principales

Backend:

- `afromercado/prisma/schema.prisma`
- `afromercado/prisma/migrations/20260626220000_pagos_marketplace/migration.sql`
- `afromercado/src/services/pago-digital.service.js`
- `afromercado/src/services/cuenta-dispersion.service.js`
- `afromercado/src/services/payments/provider-factory.js`
- `afromercado/src/services/payments/providers/sandbox.provider.js`
- `afromercado/src/services/payments/providers/wompi.provider.js`
- `afromercado/src/utils/cuentas-dispersion.js`
- `afromercado/src/controllers/pago.controller.js`
- `afromercado/src/routes/pago.routes.js`
- `afromercado/src/controllers/comercio.controller.js`
- `afromercado/src/routes/comercio.routes.js`

Frontend:

- `afromercado-web/app/pedido/[id]/pago/page.tsx`
- `afromercado-web/app/comerciante/dashboard/page.tsx`
- `afromercado-web/app/comerciante/perfil/page.tsx`
- `afromercado-web/components/comerciante/api.ts`
- `afromercado-web/components/checkout/estadoPedido.tsx`
- `afromercado-web/app/terminos/page.tsx`

## Modelos agregados

### CuentaDispersionComercio

Guarda la cuenta donde la pasarela debe dispersar el dinero al comerciante.

No se guarda el numero completo de cuenta en claro. Se guarda:

- Banco o billetera.
- Tipo de cuenta.
- Titular.
- Documento.
- Ultimos 4 digitos.
- Hash interno de la cuenta.
- ID del beneficiario en la pasarela.
- Estado de verificacion.

Estados:

- `PENDIENTE_VERIFICACION`
- `VERIFICADA`
- `RECHAZADA`
- `SUSPENDIDA`

### PagoEvento

Guarda eventos/webhooks recibidos de la pasarela para trazabilidad e idempotencia.

### PagoDispersion

Representa cuanto se debe dispersar a cada comerciante por cada subpedido.

Campos clave:

- `montoBruto`
- `comision`
- `montoNeto`
- `estado`
- `providerTransferId`

Estados:

- `PENDIENTE`
- `PROGRAMADA`
- `ENVIADA`
- `CONFIRMADA`
- `FALLIDA`
- `CANCELADA`
- `REVERTIDA`

## Flujo del comprador

1. El comprador confirma el pedido.
2. Entra a `/pedido/:id/pago`.
3. Presiona `Pagar seguro ahora`.
4. El frontend llama `POST /pagos/checkout`.
5. El backend valida:
   - pedido pertenece al comprador,
   - pedido esta pendiente de pago,
   - el pedido no expiro,
   - todos los comercios del pedido tienen cuenta de dispersion verificada,
   - la pasarela esta configurada.
6. El backend crea:
   - `Pago` con metodo `PASARELA`,
   - `PagoDispersion` por cada subpedido/comerciante,
   - referencia de proveedor.
7. La pasarela devuelve `checkoutUrl`.
8. El comprador es redirigido a la pasarela.
9. La pasarela confirma por webhook.
10. El backend confirma el pago, descuenta stock, confirma pedido y dispara dispersiones.

## Flujo del comerciante

En `Mi tienda`, el comerciante tiene una nueva seccion:

`Cuenta para recibir pagos`

Debe registrar:

- Banco o billetera.
- Tipo de cuenta: ahorros, corriente o billetera digital soportada.
- Numero completo de cuenta.
- Nombre del titular.

Despues de guardar, la interfaz solo muestra banco, tipo de cuenta y ultimos 4 digitos.

En el dashboard del comerciante tambien se muestra un aviso cuando la cuenta de dispersion no existe o no esta verificada. Ese aviso lleva directo a `Mi tienda` para registrarla.

Si el proveedor activo es `SANDBOX`, la interfaz muestra la cuenta como `modo prueba`, aunque internamente el estado sea `VERIFICADA`. Esa marca no representa verificacion bancaria real ni habilita dispersion real de dinero.

## Endpoints nuevos

### Comercios

`GET /api/comercios/cuenta-dispersion`

Devuelve la cuenta segura del comercio autenticado.

`PUT /api/comercios/cuenta-dispersion`

Registra o actualiza la cuenta de dispersion del comercio.

Body:

```json
{
  "bancoCodigo": "BANCOLOMBIA",
  "tipoCuenta": "AHORROS",
  "numeroCuenta": "1234567890",
  "titularNombre": "Artesanias del Pacifico",
  "tipoDocumento": "NIT",
  "numeroDocumento": "900123456"
}
```

### Pagos

`POST /api/pagos/checkout`

Crea un checkout digital.

Body:

```json
{
  "pedidoId": 123,
  "idempotencyKey": "checkout-123-uuid"
}
```

Respuesta:

```json
{
  "ok": true,
  "data": {
    "id": 1,
    "pedidoId": 123,
    "monto": 100000,
    "estado": "PENDIENTE",
    "proveedor": "WOMPI",
    "checkoutUrl": "https://..."
  }
}
```

`GET /api/pagos/pedido/:pedidoId/estado`

Consulta el ultimo pago digital del pedido.

`GET /api/pagos/:id/estado`

Consulta un pago digital por ID.

`POST /api/pagos/webhooks/:proveedor`

Recibe eventos de la pasarela.

Ejemplo:

`POST /api/pagos/webhooks/wompi`

## Proveedores

### SANDBOX

Proveedor de desarrollo.

Sirve para probar:

- registro de beneficiarios,
- creacion de checkout,
- creacion de dispersiones,
- estructura de estados.

No debe usarse como proveedor productivo.

Importante: `SANDBOX` puede responder `VERIFICADA` para probar que el flujo completo funciona. Esa respuesta es simulada. No consulta bancos, no valida titular real, no confirma Nequi/Bancolombia/Davivienda y no dispersa dinero real.

### WOMPI

Quedo implementado como adaptador productivo para:

- Web Checkout firmado.
- Validacion criptografica de eventos.
- Registro estructural de cuentas de dispersion.
- Creacion de lotes de Pagos a Terceros por API.
- Dispersion por cada subpedido/comerciante.

Requiere contrato activo, Pagos a Terceros activo y credenciales oficiales. Si faltan credenciales, falla cerrado y no confirma pagos artificialmente.

Detalle de activacion: `Documentacion/Pasarela-Produccion-Wompi.md`.

## Variables de entorno

Recomendadas para produccion:

```env
PAYMENT_PROVIDER=WOMPI
WOMPI_PUBLIC_KEY=
WOMPI_INTEGRITY_SECRET=
WOMPI_EVENTS_SECRET=
WOMPI_PAYOUTS_API_URL=https://api.payouts.wompi.co/v1
WOMPI_PAYOUTS_API_KEY=
WOMPI_PAYOUTS_USER_PRINCIPAL_ID=
WOMPI_PAYOUTS_ACCOUNT_ID=
FRONTEND_URL=https://afro-mercado.vercel.app
CUENTAS_DISPERSION_SECRET=
PAGOS_MANUALES_HABILITADOS=false
```

Para desarrollo local:

```env
PAYMENT_PROVIDER=SANDBOX
FRONTEND_URL=http://localhost:3002
PAGOS_MANUALES_HABILITADOS=true
```

## Seguridad aplicada

- El comprador no sube comprobantes.
- El pedido no se confirma por redirect.
- El pedido solo se confirma por evento de pasarela.
- Si alguna tienda del pedido no tiene cuenta de dispersion activa, el pago digital no inicia.
- Los eventos se guardan en `PagoEvento`.
- Se usa `idempotencyKey` para evitar pagos duplicados.
- La cuenta bancaria no se guarda completa en claro.
- El backend conserva `rawBody` para futura validacion de firmas.
- En produccion, los pagos manuales quedan apagados por defecto.

## Limitaciones actuales

La integracion tecnica de Wompi queda implementada, pero la activacion real depende de condiciones externas:

1. Confirmar contrato y activacion de Wompi Pagos a Terceros.
2. Configurar llaves productivas y secretos.
3. Configurar `accountId` origen para dispersion.
4. Registrar webhook oficial en Wompi.
5. Mapear `bankId` si Wompi entrega IDs distintos a los codigos de la documentacion.
6. Pedir a comerciantes registrar nuevamente sus cuentas para guardar el numero cifrado.
7. Hacer prueba real controlada y conciliacion.

## Validaciones realizadas

Comandos ejecutados:

```bash
npm test
npm run lint
npm run build
npx prisma validate
node --check src/services/pago-digital.service.js
node --check src/services/cuenta-dispersion.service.js
node --check src/services/payments/provider-factory.js
node --check src/services/payments/providers/sandbox.provider.js
node --check src/services/payments/providers/wompi.provider.js
node --check src/controllers/pago.controller.js
node --check src/controllers/comercio.controller.js
```

Resultado:

- Backend unit tests: OK.
- Frontend lint: OK.
- Frontend build: OK.
- Prisma validate: OK.
- Syntax checks backend: OK.

Nota local:

`npx prisma generate` fallo en Windows por bloqueo del archivo `query_engine-windows.dll.node`. Es el mismo bloqueo observado antes cuando hay procesos Node usando Prisma. En deploy limpio deberia generarse en `postinstall`; localmente basta cerrar procesos Node que usen Prisma y repetir `npx prisma generate`.

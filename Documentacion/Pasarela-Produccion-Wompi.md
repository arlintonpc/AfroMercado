# Pasarela de pago en produccion con Wompi

Fecha: 2026-06-27

## Estado implementado

Se implemento el adaptador productivo de `WOMPI` para que AfroMercado pueda operar pagos digitales sin comprobantes manuales y con dispersion por comerciante mediante Pagos a Terceros.

La implementacion queda lista a nivel tecnico, pero solo debe activarse en produccion cuando AfroMercado tenga:

- Comercio Wompi activo.
- Producto Pagos a Terceros activo.
- Llaves productivas configuradas.
- Webhook configurado en el dashboard de Wompi.
- Cuenta origen de dispersion configurada en Wompi.

## Fuentes oficiales consultadas

- Web Checkout: https://docs.wompi.co/docs/colombia/widget-checkout-web/
- Eventos y firma de webhooks: https://docs.wompi.co/docs/colombia/eventos/
- Pagos a Terceros API: https://docs.wompi.co/docs/colombia/introduccion-pagos-a-terceros/
- Llaves de Pagos a Terceros: https://docs.wompi.co/docs/colombia/ambientes-y-llaves-pagos-a-terceros/
- Crear lote de pagos: https://docs.wompi.co/docs/colombia/crea-tu-primer-lote/

## Archivos modificados

- `afromercado/src/services/payments/providers/wompi.provider.js`
- `afromercado/src/services/pago-digital.service.js`
- `afromercado/src/services/cuenta-dispersion.service.js`
- `afromercado/src/utils/cuentas-dispersion.js`
- `afromercado/prisma/schema.prisma`
- `afromercado/prisma/migrations/20260627120000_wompi_produccion/migration.sql`

## Que hace ahora el adaptador Wompi

### Cobro al comprador

- Genera URL de Web Checkout de Wompi.
- Calcula firma de integridad con SHA-256.
- Envia referencia unica de AfroMercado.
- Incluye monto en centavos.
- Incluye expiracion del pedido si existe.
- Redirige al comprador a Wompi.

### Webhook

- Valida `X-Event-Checksum` o `signature.checksum`.
- Usa las propiedades firmadas que Wompi envia dinamicamente.
- Concatena propiedades, `timestamp` y secreto de eventos.
- Rechaza eventos con firma invalida.
- Busca el pago por `providerReference`.
- Guarda el ID real de transaccion Wompi cuando llega.
- Confirma el pedido solo si Wompi reporta estado aprobado.
- Valida que el monto reportado por Wompi coincida con el monto esperado.

### Dispersion a comerciantes

- Crea un lote en `POST /payouts`.
- Envia una transaccion por cada comerciante/subpedido.
- Usa `accountId` de la cuenta origen configurada en Wompi.
- Usa `paymentType=PROVIDERS` por defecto.
- Usa `idempotency-key` estable por pago para evitar duplicados.
- Guarda el estado de dispersion como `ENVIADA`, `PROGRAMADA`, `CONFIRMADA` o `FALLIDA` segun respuesta.

## Seguridad de cuentas bancarias

Antes solo se guardaban ultimos 4 digitos y hash. Para dispersion real se necesita enviar la cuenta al proveedor, por eso se agrego:

- `numeroCuentaCifrado`: cuenta bancaria cifrada con AES-256-GCM.
- `providerBankId`: identificador del banco en Wompi.
- `providerPayload`: metadata no sensible de la pasarela.

El numero completo de cuenta no se devuelve al frontend ni se muestra al comerciante.

En produccion es obligatorio configurar `CUENTAS_DISPERSION_SECRET` con al menos 32 caracteres.

## Variables de entorno requeridas

```env
PAYMENT_PROVIDER=WOMPI
PAGOS_MANUALES_HABILITADOS=false
FRONTEND_URL=https://afro-mercado.vercel.app

# Cifrado interno de cuentas
CUENTAS_DISPERSION_SECRET=CAMBIAR_POR_UN_SECRETO_LARGO_DE_32_O_MAS_CARACTERES

# Web Checkout Wompi
WOMPI_PUBLIC_KEY=pub_prod_xxxxxxxxx
WOMPI_INTEGRITY_SECRET=prod_integrity_xxxxxxxxx

# Webhooks Wompi
WOMPI_EVENTS_SECRET=prod_events_xxxxxxxxx

# Pagos a Terceros Wompi
WOMPI_PAYOUTS_API_URL=https://api.payouts.wompi.co/v1
WOMPI_PAYOUTS_API_KEY=xxxxxxxxx
WOMPI_PAYOUTS_USER_PRINCIPAL_ID=xxxxxxxxx
WOMPI_PAYOUTS_ACCOUNT_ID=xxxxxxxxx
WOMPI_PAYOUTS_PAYMENT_TYPE=PROVIDERS
```

Opcional si Wompi entrega IDs especificos de bancos:

```env
WOMPI_PAYOUT_BANK_MAP={"BANCOLOMBIA":"bank-id-wompi","NEQUI":"bank-id-wompi"}
```

## Webhook que debe registrarse en Wompi

```text
POST https://TU_BACKEND/api/pagos/webhooks/wompi
```

Debe apuntar al backend, no al frontend.

## Importante sobre verificacion bancaria

El registro de cuenta en AfroMercado valida:

- Banco soportado.
- Tipo de documento soportado por Wompi Payouts: `CC`, `CE`, `NIT`.
- Numero de cuenta numerico.
- Titular obligatorio.
- Cifrado seguro de la cuenta.
- `bankId` resoluble para Wompi.

La existencia real de la cuenta, bloqueo, restricciones o coincidencia exacta titular-cuenta se confirma por Wompi durante el proceso de dispersion. Si Wompi rechaza una transferencia, AfroMercado deja la dispersion como `FALLIDA` para revision operativa.

## Activacion recomendada

1. Activar Wompi y Pagos a Terceros.
2. Configurar variables en el backend.
3. Ejecutar migraciones en produccion.
4. Ejecutar `npx prisma generate` en deploy.
5. Pedir a cada comerciante registrar nuevamente su cuenta para generar `numeroCuentaCifrado` y `providerBankId`.
6. Configurar webhook en Wompi.
7. Hacer una compra de prueba con monto pequeno.
8. Verificar que el pago quede `CONFIRMADO`.
9. Verificar que cada `PagoDispersion` quede en estado esperado.
10. Revisar conciliacion en el dashboard de Wompi.

## Fallas seguras

El sistema no confirma un pago si:

- La firma del webhook es invalida.
- El monto reportado por Wompi no coincide.
- El pedido no pertenece al comprador.
- El pedido esta expirado.
- Alguna tienda no tiene cuenta de dispersion verificada.

Si el pago fue aprobado pero la dispersion falla, el pedido queda confirmado y la dispersion queda marcada como fallida para revision. Esto evita cobrar dos veces al comprador por reintentos del webhook.

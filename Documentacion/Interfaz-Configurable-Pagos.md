# Interfaz configurable de pagos

Fecha: 2026-06-27

## Que se implemento

Se agrego una pantalla administrativa para controlar la configuracion operativa de pagos sin tocar codigo.

Ruta:

```text
/admin/pagos-config
```

## Capacidades

- Ver proveedor activo: `SANDBOX` o `WOMPI`.
- Cambiar proveedor activo desde el panel admin.
- Activar o desactivar pagos manuales.
- Ver si Wompi esta listo para cobro real.
- Ver estado de variables requeridas sin exponer secretos completos.
- Guardar credenciales de Wompi desde el panel.
- Ver URL de webhook para registrar en Wompi.
- Ejecutar prueba de configuracion.

## Seguridad

La interfaz no muestra llaves completas. Solo muestra previews enmascarados.

Las llaves sensibles pueden configurarse por variables de entorno o desde el panel.
Si existen en variables de entorno, tienen prioridad sobre las guardadas en `Config`.

Llaves sensibles:

- `WOMPI_INTEGRITY_SECRET`
- `WOMPI_EVENTS_SECRET`
- `WOMPI_PAYOUTS_API_KEY`
- `CUENTAS_DISPERSION_SECRET`

La pantalla no revela valores completos ya guardados; solo muestra previews enmascarados.
Los campos vacios no sobrescriben credenciales existentes.

## Configuracion persistente

Se guardan en la tabla `Config`:

- `pagos.provider`
- `pagos.manuales_habilitados`
- `pagos.wompi.WOMPI_PUBLIC_KEY`
- `pagos.wompi.WOMPI_INTEGRITY_SECRET`
- `pagos.wompi.WOMPI_EVENTS_SECRET`
- `pagos.wompi.WOMPI_PAYOUTS_API_URL`
- `pagos.wompi.WOMPI_PAYOUTS_API_KEY`
- `pagos.wompi.WOMPI_PAYOUTS_USER_PRINCIPAL_ID`
- `pagos.wompi.WOMPI_PAYOUTS_ACCOUNT_ID`
- `pagos.wompi.WOMPI_PAYOUTS_PAYMENT_TYPE`
- `pagos.wompi.WOMPI_PAYOUT_BANK_MAP`

Los nuevos pagos digitales leen `pagos.provider`, por eso el cambio tiene efecto en el flujo real.
El adaptador Wompi lee primero variables de entorno y luego valores guardados en `Config`.

## Endpoints agregados

```text
GET  /api/admin/pagos/configuracion
PUT  /api/admin/pagos/configuracion
POST /api/admin/pagos/configuracion/probar
```

## Archivos modificados

Backend:

- `afromercado/src/services/payment-config.service.js`
- `afromercado/src/services/payments/provider-factory.js`
- `afromercado/src/services/pago-digital.service.js`
- `afromercado/src/services/cuenta-dispersion.service.js`
- `afromercado/src/services/pago.service.js`
- `afromercado/src/controllers/admin.controller.js`
- `afromercado/src/routes/admin.routes.js`

Frontend:

- `afromercado-web/app/admin/pagos-config/page.tsx`
- `afromercado-web/app/admin/layout.tsx`
- `afromercado-web/components/admin/api.ts`

## Flujo operativo recomendado

1. En desarrollo, usar `SANDBOX`.
2. En produccion, configurar variables de Wompi.
3. Entrar a `/admin/pagos-config`.
4. Confirmar que todas las variables requeridas estan configuradas.
5. Cambiar proveedor a `WOMPI`.
6. Apagar pagos manuales.
7. Probar configuracion.
8. Hacer una compra real de bajo monto.
9. Revisar pago, webhook y dispersion.

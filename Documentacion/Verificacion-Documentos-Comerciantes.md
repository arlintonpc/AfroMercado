# Verificacion de documentos de comerciantes

Fecha: 2026-06-26

## Decision

El documento del comerciante debe cargarse por ambos lados:

- Frente del documento.
- Reverso del documento.

La foto anterior (`fotoDocumentoUrl`) se conserva como compatibilidad y se migra al nuevo campo `fotoDocumentoFrenteUrl`.

Importante: una libreta militar, carnet, certificado, recibo o logo no cuenta como documento de identidad para aprobar el comercio. Aunque una libreta militar sea oficial, no reemplaza la cedula/documento registrado para este flujo.

## Que se implemento

### Base de datos

Modelo `Comercio`:

- `fotoDocumentoFrenteUrl`
- `fotoDocumentoReversoUrl`
- `fotoDocumentoFrenteHash`
- `fotoDocumentoReversoHash`

Migracion:

- `afromercado/prisma/migrations/20260626233000_documento_doble_lado/migration.sql`

La migracion copia la foto antigua al campo de frente cuando existe.

### Backend

Endpoint existente:

`POST /api/comercios/subir-documento`

Ahora recibe:

```txt
documento: archivo JPG/PNG
lado: FRENTE | REVERSO
```

Validaciones basicas:

- Solo JPG o PNG.
- Maximo 5 MB.
- Minimo 40 KB.
- Resolucion minima razonable.
- Proporcion no excesivamente recortada.
- En frontend se analiza densidad visual basica para bloquear imagenes simples como logos o fondos con poco detalle.
- Se calcula una huella SHA-256 para impedir usar exactamente la misma imagen como frente y reverso.

Si la imagen no pasa validacion, el archivo se elimina y no se guarda en el comercio.

Limitacion: una libreta militar, carnet u otro documento con mucho texto puede pasar los filtros visuales porque se parece a una imagen documental. Para bloquear eso de forma confiable se requiere OCR/KYC.

### Frontend comerciante

En `Mi tienda`, la seccion de documento ahora muestra dos tarjetas:

- Frente del documento.
- Reverso del documento.

Cada tarjeta permite subir o cambiar su foto.

### Admin

El panel de comerciantes muestra enlaces separados:

- Frente.
- Reverso.

Las senales de riesgo ahora avisan si falta el frente o si falta el reverso.

El modal de aprobacion exige confirmacion manual de que ambos lados corresponden al documento de identidad del comerciante. El backend tambien bloquea aprobar o rehabilitar comercios sin frente y reverso cargados.

## Bloqueo de publicacion y venta

Subir imagenes no habilita automaticamente al comercio para vender.

Para crear productos, activar productos o aparecer en el catalogo publico, el comercio debe cumplir:

- Tienda `APROBADO`.
- Comercio `verificado` y `activo`.
- Frente y reverso del documento cargados.
- Cuenta de dispersion registrada y `VERIFICADA`.
- En produccion, la cuenta no puede pertenecer a `SANDBOX`.

Si el admin rechaza o suspende un comercio, los productos activos de ese comercio se desactivan automaticamente. Si luego el comercio vuelve a aprobarse, el comerciante puede revisar y activar sus productos manualmente.

El catalogo, el detalle de producto, recomendaciones, historial de vistas y carrito filtran productos usando esta misma regla. Esto evita que productos viejos sigan visibles si el comercio pierde aprobacion o no tiene pagos/documentos completos.

## Cambios criticos despues de aprobacion

Si un comercio aprobado cambia datos criticos, la aprobacion no se mantiene automaticamente.

Cambios criticos actuales:

- Frente del documento de identidad.
- Reverso del documento de identidad.
- Cuenta bancaria o billetera para recibir pagos.
- Titular, documento del titular, banco, tipo de cuenta o numero de cuenta.

Comportamiento implementado:

- El comercio pasa a `PENDIENTE_REVISION`.
- `verificado` queda en `false`.
- `activo` queda en `false`.
- Los productos activos del comercio se desactivan automaticamente.
- Se registra un historial de cambio critico con snapshot anterior y nuevo.
- Si existe un administrador previo valido, tambien se registra una accion de moderacion automatica.
- Se notifica al comerciante y a los administradores.

La app solo dispara esta revision cuando detecta un cambio real. Si el comerciante vuelve a subir la misma imagen del mismo lado o guarda la misma cuenta sensible, no se genera una revision innecesaria.

Si el comercio estaba `RECHAZADO`, cambiar documento o cuenta tambien lo devuelve a `PENDIENTE_REVISION` para que el admin pueda revisar la correccion. Si el comercio esta `SUSPENDIDO`, no se rehabilita automaticamente.

### Historial antes/despues

Modelo agregado:

- `CambioCriticoComercio`

Campos principales:

- `comercioId`
- `tipo`: `DOCUMENTO_IDENTIDAD`, `CUENTA_DISPERSION` u otro tipo futuro.
- `estado`: `PENDIENTE`, `APROBADO`, `RECHAZADO` o `SUSPENDIDO`.
- `snapshotAnterior`
- `snapshotNuevo`
- `solicitadoPor`
- `revisadoPor`
- `productosDesactivados`
- `createdAt`
- `revisadoAt`

Para documentos, el snapshot guarda URLs de frente y reverso anteriores/nuevas para que el administrador compare visualmente.

Para cuenta de dispersion, el snapshot no guarda el numero completo. Guarda proveedor, banco, tipo de cuenta, titular, documento del titular, ultimos 4 digitos y hash de cuenta.

Si el comerciante cambia primero un lado del documento y despues cambia el otro lado mientras la tienda ya esta en revision, la app no crea un caso separado. Actualiza el mismo cambio critico pendiente y conserva el `snapshotAnterior` original. Asi el admin ve un solo antes/despues con frente y reverso consolidados.

El panel administrador muestra estos cambios en la columna `Cambios criticos` con miniaturas clicables de frente y reverso para el antes/despues. Si hay cambios pendientes, antes de aprobar el comercio el admin debe confirmar que comparo el antes/despues.

Cuando el admin aprueba, rechaza, suspende o rehabilita el comercio, los cambios criticos pendientes se marcan con el resultado de esa decision y quedan asociados al administrador que reviso.

## Como validar que sea real

La app no debe prometer autenticidad real solo por recibir una imagen. Una foto puede ser falsa, editada, de otra persona o una captura.

Niveles recomendados:

1. Validacion basica automatica.
   - Ya implementada.
   - Sirve para rechazar archivos claramente incorrectos.

2. Revision manual del administrador.
   - Verificar que frente y reverso sean legibles.
   - Comparar nombre y numero de documento contra los datos registrados.
   - Revisar que no sea libreta militar, carnet, logo, pantallazo, imagen borrosa o documento cortado.
   - Rechazar si el frente y reverso no pertenecen al mismo documento.

3. OCR/KYC automatizado.
   - Extraer nombre, numero, fecha y tipo de documento.
   - Comparar OCR contra datos del usuario.
   - Detectar manipulacion o documentos no soportados.

4. Selfie/liveness opcional para riesgo alto.
   - Selfie del comerciante.
   - Comparacion facial con la foto del documento.
   - Prueba de vida para reducir suplantacion.

## Recomendacion experta

Para AfroMercado, la mejor ruta es gradual:

1. Exigir frente y reverso desde ya.
2. Mantener aprobacion manual del admin.
3. Antes de mover dinero real por pasarela, integrar un proveedor KYC/OCR o el flujo de verificacion del proveedor de pagos.
4. No marcar el comercio como verificado solo por subir fotos; debe pasar revision.

## Limitacion importante

La validacion implementada no garantiza que el documento sea autentico. Solo reduce errores y archivos evidentemente invalidos. La autenticidad real requiere revision humana, validacion contra fuentes oficiales o un proveedor KYC.

# Backups y recuperación — base de datos en Neon

## Estado actual (confirmado con el dueño)

AfroMercado corre en producción sobre **Neon plan Free**. Neon ofrece *point-in-time recovery* (PITR) nativo en todos sus planes, pero la ventana de retención en el plan Free es corta (históricamente unas pocas horas, no días) y no es configurable. **No hay ningún backup propio del proyecto** (ni script de `pg_dump` programado, ni exportación periódica) — toda la recuperación ante un error depende exclusivamente de esa ventana corta de Neon.

Con dinero real moviéndose (Wompi) y datos de comercios/usuarios reales, esta ventana corta es un riesgo real: un error humano (`DELETE`/`UPDATE` sin `WHERE`, una migración mal escrita) descubierto un día después ya no se podría revertir con PITR del plan Free.

## Recomendación (decisión de negocio, no técnica)

Dado que el dueño confirmó estar en el plan Free, la opción más simple y confiable es **subir a un plan de pago de Neon** (Launch o superior), que amplía la retención de PITR a varios días — verificar el número exacto vigente en el panel de Neon al momento de decidir, ya que Neon ajusta sus planes con el tiempo. Esto no requiere ningún cambio de código.

Como complemento (no como reemplazo), si se prefiere no subir de plan todavía, se puede agregar un `pg_dump` programado hacia almacenamiento externo (ej. un bucket de Cloudinary/S3 ya que Cloudinary ya está integrado, o cualquier storage barato) corriendo, por ejemplo, una vez al día vía un cron adicional del propio backend o un GitHub Action programado. Esto es una tarea de código pequeña si se decide seguir este camino — no está incluida en el plan de 6 fases por defecto porque la vía recomendada (upgrade de plan) no requiere código.

## Procedimiento de restauración manual (Neon Console)

1. Entrar a [console.neon.tech](https://console.neon.tech) → seleccionar el proyecto de AfroMercado.
2. Ir a la pestaña **Branches**.
3. Usar **"Restore"** o crear un **branch nuevo desde un punto en el tiempo** (time travel) anterior al incidente — Neon permite elegir una marca de tiempo específica dentro de la ventana de retención vigente del plan.
4. Verificar los datos en el branch restaurado antes de promoverlo o de apuntar `DATABASE_URL` hacia él.
5. Si se promueve el branch restaurado a producción, actualizar `DATABASE_URL` en Render (backend) y reiniciar el servicio.

**Importante:** este procedimiento solo funciona dentro de la ventana de retención de PITR contratada. Fuera de esa ventana, sin un backup propio adicional, los datos no son recuperables.

## Próximo paso sugerido

Confirmar con el dueño si se sube de plan en Neon o si se prefiere agregar el `pg_dump` programado como complemento — ninguna de las dos opciones está bloqueando el resto del plan de 6 fases, pero conviene resolverlo pronto dado que hay dinero real en juego.

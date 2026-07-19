-- Denuncia de Producto: cierra el hueco de protección para "venta con
-- contacto directo" (sin RUT/cuenta verificada, sin Pedido en plataforma) —
-- el sistema Disputa existente exige un Pedido/reserva ya completado y no
-- aplica a contactos solo por WhatsApp. Mismo patrón que DenunciaInmueble.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MotivoDenunciaProducto') THEN
    CREATE TYPE "MotivoDenunciaProducto" AS ENUM ('PRODUCTO_FALSO', 'ESTAFA_DINERO', 'CONTENIDO_INAPROPIADO', 'VENDEDOR_SOSPECHOSO', 'OTRO');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EstadoDenunciaProducto') THEN
    CREATE TYPE "EstadoDenunciaProducto" AS ENUM ('PENDIENTE', 'DESESTIMADA', 'PRODUCTO_BLOQUEADO', 'CUENTA_BLOQUEADA');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "DenunciaProducto" (
  "id"            SERIAL NOT NULL,
  "productoId"    INTEGER NOT NULL,
  "denuncianteId" INTEGER NOT NULL,
  "motivo"        "MotivoDenunciaProducto" NOT NULL,
  "descripcion"   TEXT,
  "estado"        "EstadoDenunciaProducto" NOT NULL DEFAULT 'PENDIENTE',
  "revisadoPor"   INTEGER,
  "revisadoAt"    TIMESTAMP(3),
  "notaRevision"  TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DenunciaProducto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DenunciaProducto_productoId_denuncianteId_key" ON "DenunciaProducto"("productoId", "denuncianteId");
CREATE INDEX IF NOT EXISTS "DenunciaProducto_estado_createdAt_idx" ON "DenunciaProducto"("estado", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DenunciaProducto_productoId_fkey') THEN
    ALTER TABLE "DenunciaProducto" ADD CONSTRAINT "DenunciaProducto_productoId_fkey"
      FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DenunciaProducto_denuncianteId_fkey') THEN
    ALTER TABLE "DenunciaProducto" ADD CONSTRAINT "DenunciaProducto_denuncianteId_fkey"
      FOREIGN KEY ("denuncianteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

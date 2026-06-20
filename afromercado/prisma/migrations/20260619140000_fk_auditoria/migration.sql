-- FK constraints para campos de auditoría que referenciaban Usuario sin constraint explícito

-- AccionModeracion.adminId → Usuario
ALTER TABLE "AccionModeracion"
  ADD CONSTRAINT "AccionModeracion_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "Usuario"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  NOT VALID;

-- ComisionComercio.creadoPor → Usuario
ALTER TABLE "ComisionComercio"
  ADD CONSTRAINT "ComisionComercio_creadoPor_fkey"
  FOREIGN KEY ("creadoPor") REFERENCES "Usuario"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  NOT VALID;

-- PrecioHistorial.cambiadoPor → Usuario
ALTER TABLE "PrecioHistorial"
  ADD CONSTRAINT "PrecioHistorial_cambiadoPor_fkey"
  FOREIGN KEY ("cambiadoPor") REFERENCES "Usuario"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE
  NOT VALID;

-- Comercio.revisadoPor → Usuario (nullable)
ALTER TABLE "Comercio"
  ADD CONSTRAINT "Comercio_revisadoPor_fkey"
  FOREIGN KEY ("revisadoPor") REFERENCES "Usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;

-- Comercio.whatsappAprobadoPor → Usuario (nullable)
ALTER TABLE "Comercio"
  ADD CONSTRAINT "Comercio_whatsappAprobadoPor_fkey"
  FOREIGN KEY ("whatsappAprobadoPor") REFERENCES "Usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;

-- SolicitudRepartidor.revisadoPor → Usuario (nullable)
ALTER TABLE "SolicitudRepartidor"
  ADD CONSTRAINT "SolicitudRepartidor_revisadoPor_fkey"
  FOREIGN KEY ("revisadoPor") REFERENCES "Usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;

-- Pago.verificadoPor → Usuario (nullable)
ALTER TABLE "Pago"
  ADD CONSTRAINT "Pago_verificadoPor_fkey"
  FOREIGN KEY ("verificadoPor") REFERENCES "Usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;

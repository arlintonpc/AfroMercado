-- Agrega FK formal entre Entrega.repartidorId → Usuario.id
-- La columna ya existe; solo se añade la restricción de clave foránea.
ALTER TABLE "Entrega"
  ADD CONSTRAINT "Entrega_repartidorId_fkey"
  FOREIGN KEY ("repartidorId")
  REFERENCES "Usuario"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

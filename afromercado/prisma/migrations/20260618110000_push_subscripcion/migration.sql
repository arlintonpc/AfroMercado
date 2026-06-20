CREATE TABLE "PushSubscripcion" (
    "id"        SERIAL       PRIMARY KEY,
    "usuarioId" INTEGER      NOT NULL,
    "endpoint"  TEXT         NOT NULL,
    "p256dh"    TEXT         NOT NULL,
    "auth"      TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscripcion_usuarioId_fkey"
      FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PushSubscripcion_endpoint_key" ON "PushSubscripcion"("endpoint");
CREATE INDEX "PushSubscripcion_usuarioId_idx" ON "PushSubscripcion"("usuarioId");

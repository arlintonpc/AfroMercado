-- CreateTable: ReviewTransporte
CREATE TABLE "ReviewTransporte" (
    "id"                  SERIAL PRIMARY KEY,
    "configTransporteId"  INTEGER NOT NULL,
    "clienteId"           INTEGER NOT NULL,
    "reservaTransporteId" INTEGER NOT NULL,
    "calificacion"        INTEGER NOT NULL,
    "comentario"          TEXT,
    "creadoAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewTransporte_reservaTransporteId_key" UNIQUE ("reservaTransporteId")
);

-- CreateTable: ReviewExpress
CREATE TABLE "ReviewExpress" (
    "id"              SERIAL PRIMARY KEY,
    "configExpressId" INTEGER NOT NULL,
    "clienteId"       INTEGER NOT NULL,
    "pedidoExpressId" INTEGER NOT NULL,
    "calificacion"    INTEGER NOT NULL,
    "comentario"      TEXT,
    "creadoAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewExpress_pedidoExpressId_key" UNIQUE ("pedidoExpressId")
);

-- CreateIndex
CREATE INDEX "ReviewTransporte_configTransporteId_idx" ON "ReviewTransporte"("configTransporteId");
CREATE INDEX "ReviewExpress_configExpressId_idx"       ON "ReviewExpress"("configExpressId");

-- AddForeignKey
ALTER TABLE "ReviewTransporte" ADD CONSTRAINT "ReviewTransporte_configTransporteId_fkey"
    FOREIGN KEY ("configTransporteId") REFERENCES "ConfigTransporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewTransporte" ADD CONSTRAINT "ReviewTransporte_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReviewTransporte" ADD CONSTRAINT "ReviewTransporte_reservaTransporteId_fkey"
    FOREIGN KEY ("reservaTransporteId") REFERENCES "ReservaTransporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewExpress" ADD CONSTRAINT "ReviewExpress_configExpressId_fkey"
    FOREIGN KEY ("configExpressId") REFERENCES "ConfigExpress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewExpress" ADD CONSTRAINT "ReviewExpress_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReviewExpress" ADD CONSTRAINT "ReviewExpress_pedidoExpressId_fkey"
    FOREIGN KEY ("pedidoExpressId") REFERENCES "PedidoExpress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

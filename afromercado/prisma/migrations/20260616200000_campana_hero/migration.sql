-- CreateTable
CREATE TABLE "CampanaHero" (
    "id"          SERIAL         NOT NULL,
    "titulo"      TEXT           NOT NULL,
    "subtitulo"   TEXT,
    "imagenUrl"   TEXT           NOT NULL,
    "ctaTexto"    TEXT           NOT NULL DEFAULT 'Ver más',
    "urlDestino"  TEXT           NOT NULL,
    "activa"      BOOLEAN        NOT NULL DEFAULT true,
    "prioridad"   INTEGER        NOT NULL DEFAULT 0,
    "inicio"      TIMESTAMP(3)   NOT NULL,
    "fin"         TIMESTAMP(3)   NOT NULL,
    "montoCOP"    DECIMAL(10,2),
    "notas"       TEXT,
    "vistas"      INTEGER        NOT NULL DEFAULT 0,
    "clics"       INTEGER        NOT NULL DEFAULT 0,
    "creadoPor"   INTEGER        NOT NULL,
    "createdAt"   TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampanaHero_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampanaHero_activa_fin_idx" ON "CampanaHero"("activa", "fin");

-- AddForeignKey
ALTER TABLE "CampanaHero" ADD CONSTRAINT "CampanaHero_creadoPor_fkey"
    FOREIGN KEY ("creadoPor") REFERENCES "Usuario"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

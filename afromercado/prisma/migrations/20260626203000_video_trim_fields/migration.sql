ALTER TABLE "Comercio"
ADD COLUMN "videoDuracionOriginalSegundos" DOUBLE PRECISION,
ADD COLUMN "videoRecorteInicioSegundos" DOUBLE PRECISION,
ADD COLUMN "videoRecorteFinSegundos" DOUBLE PRECISION;

ALTER TABLE "Producto"
ADD COLUMN "videoDuracionOriginalSegundos" DOUBLE PRECISION,
ADD COLUMN "videoRecorteInicioSegundos" DOUBLE PRECISION,
ADD COLUMN "videoRecorteFinSegundos" DOUBLE PRECISION;

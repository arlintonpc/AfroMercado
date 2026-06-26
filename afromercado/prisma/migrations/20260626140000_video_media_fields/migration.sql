ALTER TABLE "Comercio"
ADD COLUMN "videoUrl" TEXT,
ADD COLUMN "videoPosterUrl" TEXT,
ADD COLUMN "videoPublicId" TEXT,
ADD COLUMN "videoDuracionSegundos" DOUBLE PRECISION,
ADD COLUMN "videoAncho" INTEGER,
ADD COLUMN "videoAlto" INTEGER,
ADD COLUMN "videoBytes" INTEGER,
ADD COLUMN "videoFormato" TEXT,
ADD COLUMN "videoMimeType" TEXT;

ALTER TABLE "Producto"
ADD COLUMN "videoUrl" TEXT,
ADD COLUMN "videoPosterUrl" TEXT,
ADD COLUMN "videoPublicId" TEXT,
ADD COLUMN "videoDuracionSegundos" DOUBLE PRECISION,
ADD COLUMN "videoAncho" INTEGER,
ADD COLUMN "videoAlto" INTEGER,
ADD COLUMN "videoBytes" INTEGER,
ADD COLUMN "videoFormato" TEXT,
ADD COLUMN "videoMimeType" TEXT;

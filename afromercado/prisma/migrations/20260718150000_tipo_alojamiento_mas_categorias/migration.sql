-- Módulo Hotel: amplía TipoAlojamiento con 3 categorías que faltaban en el
-- catálogo inicial (Habitación, Cabaña, Apartamento, Casa completa, Finca,
-- Glamping, Posada). Hostal se agrega porque el propio usuario lo mencionó
-- como ejemplo de categoría futura; Albergue y Resort cubren tipos de
-- alojamiento comunes en plataformas de reserva (Booking, Airbnb) que aún
-- no existían en esta lista.

ALTER TYPE "TipoAlojamiento" ADD VALUE IF NOT EXISTS 'HOSTAL';
ALTER TYPE "TipoAlojamiento" ADD VALUE IF NOT EXISTS 'ALBERGUE';
ALTER TYPE "TipoAlojamiento" ADD VALUE IF NOT EXISTS 'RESORT';

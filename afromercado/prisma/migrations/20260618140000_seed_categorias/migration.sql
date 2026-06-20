-- AfroMercado — Categorías iniciales del marketplace
-- ON CONFLICT DO NOTHING: idempotente, se puede correr varias veces sin duplicar.
INSERT INTO "Categoria" (nombre, slug, icono, activa) VALUES
  ('Del campo',            'del-campo',           '🌿', true),
  ('Frutas tropicales',    'frutas-tropicales',   '🍊', true),
  ('Cacao y chocolate',    'cacao-chocolate',     '🍫', true),
  ('Artesanías',           'artesanias',          '🎨', true),
  ('Plantas medicinales',  'plantas-medicinales', '🌱', true),
  ('Madera y muebles',     'madera-muebles',      '🪵', true),
  ('Tejidos y textiles',   'tejidos-textiles',    '🧶', true),
  ('Productos del mar',    'productos-del-mar',   '🐟', true)
ON CONFLICT (slug) DO NOTHING;

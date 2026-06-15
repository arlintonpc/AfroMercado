INSERT INTO "Categoria" (nombre, slug, icono, activa) VALUES
  ('Del Campo', 'del-campo', 'verde', true),
  ('Artesanias', 'artesanias', 'arte', true),
  ('Gastronomia', 'gastronomia', 'comida', true),
  ('Turismo', 'turismo', 'lugar', true),
  ('Cultural', 'cultural', 'musica', true)
ON CONFLICT (slug) DO NOTHING;

SELECT * FROM "Categoria";

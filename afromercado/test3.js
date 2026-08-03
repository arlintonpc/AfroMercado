const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = jwt.sign({ id: 1, rol: 'ADMIN' }, process.env.JWT_SECRET || 'secret');

fetch('http://localhost:3001/api/config/hero', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
  body: JSON.stringify({
    modo: 'FIJAS',
    intervaloSegundos: 10,
    fuente: 'ORGANICO',
    badge: '🌿 LA PLATAFORMA DE LOS TERRITORIOS DE COLOMBIA',
    titulo: 'Todo lo que un territorio\nproduce, ofrece y vive.',
    subtitulo: 'Compra productos locales, encuentra hoteles, Gastronomía, empleo, cultura y servicios. Conecta con quienes impulsan la economía de cada territorio.'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);

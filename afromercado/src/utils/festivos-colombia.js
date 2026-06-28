/**
 * Festivos colombianos según la Ley 51/1983 (Ley Emiliani) y festivos fijos.
 * No requiere dependencias externas.
 */

function pascua(anio) {
  // Algoritmo de Butcher para calcular domingo de Pascua
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 1-based
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
}

function siguienteLunes(fecha) {
  const d = new Date(fecha);
  const dow = d.getDay(); // 0=dom, 1=lun
  if (dow === 1) return d;
  const diff = dow === 0 ? 1 : 8 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function agregarDias(fecha, n) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtFecha(fecha) {
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${m}-${d}`;
}

/**
 * Retorna array de strings "YYYY-MM-DD" con todos los festivos del año.
 */
function festivosAnio(anio) {
  const p = pascua(anio);
  const festivos = [
    // Fijos
    new Date(anio, 0, 1),   // Año nuevo
    new Date(anio, 4, 1),   // Día del trabajo
    new Date(anio, 6, 20),  // Independencia
    new Date(anio, 7, 7),   // Batalla de Boyacá
    new Date(anio, 11, 8),  // Inmaculada Concepción
    new Date(anio, 11, 25), // Navidad

    // Pascua y relativos fijos
    agregarDias(p, -3),     // Jueves Santo
    agregarDias(p, -2),     // Viernes Santo
    agregarDias(p, 39),     // Ascensión (trasladado lunes)
    agregarDias(p, 60),     // Corpus Christi (trasladado lunes)
    agregarDias(p, 68),     // Sagrado Corazón (trasladado lunes)

    // Emiliani: se trasladan al siguiente lunes
    siguienteLunes(new Date(anio, 0, 6)),   // Reyes Magos (6 ene)
    siguienteLunes(new Date(anio, 2, 19)),  // San José (19 mar)
    siguienteLunes(new Date(anio, 5, 29)),  // San Pedro y San Pablo (29 jun)
    siguienteLunes(new Date(anio, 7, 15)),  // Asunción (15 ago)
    siguienteLunes(new Date(anio, 9, 12)),  // Día de la Raza (12 oct)
    siguienteLunes(new Date(anio, 10, 1)),  // Todos los Santos (1 nov)
    siguienteLunes(new Date(anio, 10, 11)), // Independencia Cartagena (11 nov)
  ];

  const unicos = [...new Set(festivos.map(fmtFecha))].sort();
  return unicos;
}

/**
 * Retorna true si la fecha dada (Date o string YYYY-MM-DD) es festivo en Colombia.
 */
function esFestivo(fecha) {
  const d = typeof fecha === 'string' ? new Date(fecha + 'T00:00:00') : new Date(fecha);
  const anio = d.getFullYear();
  const str = fmtFecha(d);
  return festivosAnio(anio).includes(str);
}

/**
 * Retorna el DiaSemana enum de Prisma para una fecha dada.
 * Tiene en cuenta festivos: si es festivo devuelve 'FESTIVO'.
 */
function diaSemanaEnum(fecha) {
  if (esFestivo(fecha)) return 'FESTIVO';
  const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  const d = typeof fecha === 'string' ? new Date(fecha + 'T00:00:00') : new Date(fecha);
  // Usamos getUTCDay porque ahoraEnColombia() ya ajustó el timestamp a UTC-5
  return DIAS[d.getUTCDay()];
}

module.exports = { festivosAnio, esFestivo, diaSemanaEnum };

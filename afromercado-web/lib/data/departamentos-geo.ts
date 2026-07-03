/**
 * Coordenadas de referencia (capital o ciudad principal) por departamento de Colombia.
 *
 * Se usa para detectar el departamento más cercano a partir del GPS del navegador,
 * sin depender de una API de geocodificación paga. La precisión es a nivel de
 * departamento (no de municipio): suficiente para decidir qué región mostrarle
 * a un usuario por defecto, dado que la distancia entre capitales departamentales
 * es siempre de decenas o cientos de kilómetros.
 *
 * Los nombres de `departamento` coinciden exactamente con `DEPARTAMENTOS` en
 * `colombia.ts` (misma fuente de verdad para el listado de departamentos).
 */

export interface CentroDepartamento {
  departamento: string
  ciudadReferencia: string
  lat: number
  lon: number
}

export const CENTROS_DEPARTAMENTOS: CentroDepartamento[] = [
  { departamento: 'Amazonas', ciudadReferencia: 'Leticia', lat: -4.2153, lon: -69.9406 },
  { departamento: 'Antioquia', ciudadReferencia: 'Medellín', lat: 6.2442, lon: -75.5812 },
  { departamento: 'Arauca', ciudadReferencia: 'Arauca', lat: 7.0844, lon: -70.7591 },
  { departamento: 'Atlántico', ciudadReferencia: 'Barranquilla', lat: 10.9639, lon: -74.7964 },
  { departamento: 'Bogotá D.C.', ciudadReferencia: 'Bogotá', lat: 4.7110, lon: -74.0721 },
  { departamento: 'Bolívar', ciudadReferencia: 'Cartagena', lat: 10.3910, lon: -75.4794 },
  { departamento: 'Boyacá', ciudadReferencia: 'Tunja', lat: 5.5353, lon: -73.3678 },
  { departamento: 'Caldas', ciudadReferencia: 'Manizales', lat: 5.0689, lon: -75.5174 },
  { departamento: 'Caquetá', ciudadReferencia: 'Florencia', lat: 1.6144, lon: -75.6062 },
  { departamento: 'Casanare', ciudadReferencia: 'Yopal', lat: 5.3378, lon: -72.3959 },
  { departamento: 'Cauca', ciudadReferencia: 'Popayán', lat: 2.4448, lon: -76.6147 },
  { departamento: 'Cesar', ciudadReferencia: 'Valledupar', lat: 10.4631, lon: -73.2532 },
  { departamento: 'Chocó', ciudadReferencia: 'Quibdó', lat: 5.6947, lon: -76.6611 },
  { departamento: 'Córdoba', ciudadReferencia: 'Montería', lat: 8.7479, lon: -75.8814 },
  { departamento: 'Cundinamarca', ciudadReferencia: 'Bogotá', lat: 4.7110, lon: -74.0721 },
  { departamento: 'Guainía', ciudadReferencia: 'Inírida', lat: 3.8653, lon: -67.9239 },
  { departamento: 'Guaviare', ciudadReferencia: 'San José del Guaviare', lat: 2.5679, lon: -72.6412 },
  { departamento: 'Huila', ciudadReferencia: 'Neiva', lat: 2.9345, lon: -75.2809 },
  { departamento: 'La Guajira', ciudadReferencia: 'Riohacha', lat: 11.5444, lon: -72.9072 },
  { departamento: 'Magdalena', ciudadReferencia: 'Santa Marta', lat: 11.2408, lon: -74.1990 },
  { departamento: 'Meta', ciudadReferencia: 'Villavicencio', lat: 4.1420, lon: -73.6266 },
  { departamento: 'Nariño', ciudadReferencia: 'Pasto', lat: 1.2136, lon: -77.2811 },
  { departamento: 'Norte de Santander', ciudadReferencia: 'Cúcuta', lat: 7.8939, lon: -72.5078 },
  { departamento: 'Putumayo', ciudadReferencia: 'Mocoa', lat: 1.1487, lon: -76.6478 },
  { departamento: 'Quindío', ciudadReferencia: 'Armenia', lat: 4.5339, lon: -75.6811 },
  { departamento: 'Risaralda', ciudadReferencia: 'Pereira', lat: 4.8133, lon: -75.6961 },
  { departamento: 'San Andrés y Providencia', ciudadReferencia: 'San Andrés', lat: 12.5847, lon: -81.7006 },
  { departamento: 'Santander', ciudadReferencia: 'Bucaramanga', lat: 7.1193, lon: -73.1227 },
  { departamento: 'Sucre', ciudadReferencia: 'Sincelejo', lat: 9.3047, lon: -75.3978 },
  { departamento: 'Tolima', ciudadReferencia: 'Ibagué', lat: 4.4389, lon: -75.2322 },
  { departamento: 'Valle del Cauca', ciudadReferencia: 'Cali', lat: 3.4516, lon: -76.5320 },
  { departamento: 'Vaupés', ciudadReferencia: 'Mitú', lat: 1.2497, lon: -70.2336 },
  { departamento: 'Vichada', ciudadReferencia: 'Puerto Carreño', lat: 6.1891, lon: -67.4859 },
]

function distanciaHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Departamento cuyo centro de referencia está más cerca de unas coordenadas dadas. */
export function departamentoMasCercano(lat: number, lon: number): CentroDepartamento {
  return CENTROS_DEPARTAMENTOS.reduce((masCercano, actual) => {
    const dActual = distanciaHaversineKm(lat, lon, actual.lat, actual.lon)
    const dMasCercano = distanciaHaversineKm(lat, lon, masCercano.lat, masCercano.lon)
    return dActual < dMasCercano ? actual : masCercano
  })
}

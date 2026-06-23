/**
 * Departamentos y municipios de Colombia para los selectores de dirección.
 *
 * Cobertura completa para Chocó y las regiones con tarifa de envío
 * (Antioquia, Valle, Cundinamarca, Bogotá, Atlántico, Bolívar) y las ciudades
 * principales del resto. En el checkout, el selector de municipio incluye
 * siempre la opción "Otro…" que permite escribirlo si no aparece en la lista.
 */

export const DEPARTAMENTOS: string[] = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar',
  'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó',
  'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira',
  'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío',
  'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima',
  'Valle del Cauca', 'Vaupés', 'Vichada',
]

export const MUNICIPIOS_POR_DEPARTAMENTO: Record<string, string[]> = {
  'Amazonas': ['Leticia', 'Puerto Nariño'],
  'Antioquia': [
    'Medellín', 'Bello', 'Itagüí', 'Envigado', 'Sabaneta', 'La Estrella',
    'Caldas', 'Copacabana', 'Girardota', 'Barbosa', 'Rionegro', 'La Ceja',
    'Marinilla', 'Guarne', 'El Retiro', 'El Carmen de Viboral', 'Apartadó',
    'Turbo', 'Carepa', 'Chigorodó', 'Necoclí', 'Caucasia', 'Yarumal',
    'Santa Fe de Antioquia', 'Andes', 'Urrao', 'Sonsón', 'Segovia', 'Puerto Berrío',
  ],
  'Arauca': ['Arauca', 'Saravena', 'Tame', 'Arauquita', 'Fortul'],
  'Atlántico': [
    'Barranquilla', 'Soledad', 'Malambo', 'Sabanalarga', 'Baranoa',
    'Puerto Colombia', 'Galapa', 'Santo Tomás', 'Sabanagrande', 'Palmar de Varela',
  ],
  'Bogotá D.C.': ['Bogotá D.C.'],
  'Bolívar': [
    'Cartagena', 'Magangué', 'Turbaco', 'Arjona', 'El Carmen de Bolívar',
    'Mompós', 'San Juan Nepomuceno', 'María La Baja', 'Santa Rosa', 'Turbaná',
  ],
  'Boyacá': ['Tunja', 'Duitama', 'Sogamoso', 'Chiquinquirá', 'Paipa', 'Puerto Boyacá'],
  'Caldas': ['Manizales', 'La Dorada', 'Chinchiná', 'Villamaría', 'Riosucio', 'Anserma'],
  'Caquetá': ['Florencia', 'San Vicente del Caguán', 'Puerto Rico', 'El Doncello'],
  'Casanare': ['Yopal', 'Aguazul', 'Villanueva', 'Tauramena', 'Monterrey'],
  'Cauca': ['Popayán', 'Santander de Quilichao', 'Puerto Tejada', 'Patía (El Bordo)', 'Guapi', 'Miranda'],
  'Cesar': ['Valledupar', 'Aguachica', 'Bosconia', 'Codazzi', 'La Jagua de Ibirico'],
  'Chocó': [
    'Quibdó', 'Acandí', 'Alto Baudó', 'Atrato', 'Bagadó', 'Bahía Solano',
    'Bajo Baudó', 'Bojayá', 'El Cantón del San Pablo', 'Carmen del Darién',
    'Cértegui', 'Condoto', 'El Carmen de Atrato', 'El Litoral del San Juan',
    'Istmina', 'Juradó', 'Lloró', 'Medio Atrato', 'Medio Baudó',
    'Medio San Juan', 'Nóvita', 'Nuquí', 'Río Iró', 'Río Quito', 'Riosucio',
    'San José del Palmar', 'Sipí', 'Tadó', 'Unión Panamericana', 'Ungía',
  ],
  'Córdoba': ['Montería', 'Lorica', 'Cereté', 'Sahagún', 'Montelíbano', 'Planeta Rica', 'Tierralta'],
  'Cundinamarca': [
    'Soacha', 'Facatativá', 'Zipaquirá', 'Chía', 'Mosquera', 'Madrid', 'Funza',
    'Fusagasugá', 'Girardot', 'Cajicá', 'Sibaté', 'Tocancipá', 'Cota',
    'La Calera', 'Ubaté', 'Villeta', 'Chocontá', 'Tenjo', 'Gachancipá', 'Sopó',
  ],
  'Guainía': ['Inírida'],
  'Guaviare': ['San José del Guaviare', 'Calamar', 'El Retorno'],
  'Huila': ['Neiva', 'Pitalito', 'Garzón', 'La Plata', 'Campoalegre', 'Gigante'],
  'La Guajira': ['Riohacha', 'Maicao', 'Uribia', 'San Juan del Cesar', 'Fonseca', 'Villanueva'],
  'Magdalena': ['Santa Marta', 'Ciénaga', 'Fundación', 'El Banco', 'Plato', 'Zona Bananera'],
  'Meta': ['Villavicencio', 'Acacías', 'Granada', 'Puerto López', 'San Martín', 'Cumaral'],
  'Nariño': ['Pasto', 'Tumaco', 'Ipiales', 'Túquerres', 'La Unión', 'Samaniego'],
  'Norte de Santander': ['Cúcuta', 'Ocaña', 'Villa del Rosario', 'Los Patios', 'Pamplona', 'Tibú'],
  'Putumayo': ['Mocoa', 'Puerto Asís', 'Orito', 'Valle del Guamuez', 'Sibundoy'],
  'Quindío': ['Armenia', 'Calarcá', 'La Tebaida', 'Montenegro', 'Quimbaya', 'Circasia'],
  'Risaralda': ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal', 'La Virginia', 'Marsella'],
  'San Andrés y Providencia': ['San Andrés', 'Providencia'],
  'Santander': ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja', 'San Gil', 'Socorro'],
  'Sucre': ['Sincelejo', 'Corozal', 'Sampués', 'San Marcos', 'Tolú', 'San Onofre'],
  'Tolima': ['Ibagué', 'Espinal', 'Melgar', 'Honda', 'Líbano', 'Chaparral', 'Mariquita'],
  'Valle del Cauca': [
    'Cali', 'Palmira', 'Buenaventura', 'Tuluá', 'Cartago', 'Buga', 'Jamundí',
    'Yumbo', 'Candelaria', 'Florida', 'Pradera', 'Zarzal', 'Sevilla',
    'Caicedonia', 'La Unión', 'Roldanillo', 'Guacarí',
  ],
  'Vaupés': ['Mitú'],
  'Vichada': ['Puerto Carreño', 'La Primavera', 'Cumaribo'],
}

/** Municipios de un departamento (vacío si no hay lista curada). */
export function municipiosDe(departamento: string): string[] {
  return MUNICIPIOS_POR_DEPARTAMENTO[departamento] ?? []
}

/**
 * Constantes compartidas del área del comerciante: municipios del Chocó,
 * unidades de venta y alcances, con etiquetas amigables en español sencillo.
 */

/**
 * Municipios de Colombia por departamento (selección principal DIVIPOLA — DANE).
 * Incluye los municipios más poblados de cada departamento.
 */
export const MUNICIPIOS_POR_DEPARTAMENTO: Record<string, string[]> = {
  'Amazonas': ['Leticia','Puerto Nariño'],
  'Antioquia': ['Medellín','Bello','Itagüí','Envigado','Apartadó','Turbo','Rionegro','Sabaneta','Copacabana','La Estrella','Caldas','Barbosa','Girardota','Caucasia','Yarumal','Andes','Santa Rosa de Osos','Marinilla','El Carmen de Viboral','Jericó'],
  'Arauca': ['Arauca','Saravena','Tame','Fortul','Arauquita','Cravo Norte','Puerto Rondón'],
  'Atlántico': ['Barranquilla','Soledad','Malambo','Sabanalarga','Baranoa','Galapa','Puerto Colombia','Palmar de Varela','Sabanagrande'],
  'Bolívar': ['Cartagena','Magangué','Turbaco','Arjona','El Carmen de Bolívar','Mompox','San Juan Nepomuceno'],
  'Boyacá': ['Tunja','Duitama','Sogamoso','Chiquinquirá','Paipa','Moniquirá','Puerto Boyacá','Garagoa'],
  'Caldas': ['Manizales','Villamaría','Chinchiná','La Dorada','Riosucio','Salamina','Aguadas','Manzanares'],
  'Caquetá': ['Florencia','San Vicente del Caguán','Puerto Rico','El Doncello','La Montañita','Belén de los Andaquíes'],
  'Casanare': ['Yopal','Aguazul','Tauramena','Villanueva','Paz de Ariporo','Monterrey','Trinidad'],
  'Cauca': ['Popayán','Santander de Quilichao','Puerto Tejada','Patía','Piendamó','El Tambo','Caloto'],
  'Cesar': ['Valledupar','Aguachica','Bosconia','Codazzi','La Jagua de Ibirico','Chiriguaná'],
  'Chocó': ['Quibdó','Acandí','Alto Baudó','Atrato','Bagadó','Bahía Solano','Bajo Baudó','Bojayá','El Cantón del San Pablo','Carmen del Darién','Cértegui','Condoto','El Carmen de Atrato','El Litoral del San Juan','Istmina','Juradó','Lloró','Medio Atrato','Medio Baudó','Medio San Juan','Nóvita','Nuquí','Río Iró','Río Quito','Riosucio','San José del Palmar','Sipí','Tadó','Unión Panamericana','Ungía'],
  'Córdoba': ['Montería','Lorica','Cereté','Sahagún','Montelíbano','Tierralta','Planeta Rica'],
  'Cundinamarca': ['Bogotá D.C.','Soacha','Facatativá','Zipaquirá','Chía','Fusagasugá','Madrid','Mosquera','Funza','La Calera','Cajicá','Sibaté','Tocancipá'],
  'Guainía': ['Inírida'],
  'Guaviare': ['San José del Guaviare','El Retorno','Calamar','Miraflores'],
  'Huila': ['Neiva','Pitalito','Garzón','La Plata','Campoalegre','Rivera','Palermo'],
  'La Guajira': ['Riohacha','Maicao','Uribia','Manaure','Fonseca','Barrancas','San Juan del Cesar'],
  'Magdalena': ['Santa Marta','Ciénaga','Fundación','El Banco','Plato','Pivijay'],
  'Meta': ['Villavicencio','Acacías','Granada','San Martín','Puerto López','Cumaral','Restrepo'],
  'Nariño': ['Pasto','Tumaco','Ipiales','Túquerres','La Unión','Samaniego','Barbacoas'],
  'Norte de Santander': ['Cúcuta','Los Patios','Villa del Rosario','Ocaña','Pamplona','Bucarasica','El Zulia'],
  'Putumayo': ['Mocoa','Puerto Asís','Orito','Valle del Guamuez','Sibundoy','San Francisco'],
  'Quindío': ['Armenia','Calarcá','Montenegro','Quimbaya','La Tebaida','Circasia','Filandia'],
  'Risaralda': ['Pereira','Dosquebradas','Santa Rosa de Cabal','La Virginia','Belén de Umbría','Quinchía'],
  'San Andrés y Providencia': ['San Andrés','Providencia'],
  'Santander': ['Bucaramanga','Floridablanca','Girón','Piedecuesta','Barrancabermeja','San Gil','Vélez','Málaga'],
  'Sucre': ['Sincelejo','Corozal','Sampués','Tolú','Morroa','San Marcos','Ovejas'],
  'Tolima': ['Ibagué','Espinal','Melgar','Honda','Chaparral','Líbano','Mariquita','Girardot'],
  'Valle del Cauca': ['Cali','Buenaventura','Palmira','Tuluá','Buga','Cartago','Yumbo','Jamundí','Floridablanca','Manizales'],
  'Vaupés': ['Mitú','Carurú','Taraira'],
  'Vichada': ['Puerto Carreño','La Primavera','Cumaribo','Santa Rosalía'],
}

/** Todos los departamentos de Colombia */
export const DEPARTAMENTOS_COLOMBIA: string[] = Object.keys(MUNICIPIOS_POR_DEPARTAMENTO).sort()

/** Municipios del Chocó — alias de MUNICIPIOS_POR_DEPARTAMENTO['Chocó'] */
export const MUNICIPIOS_CHOCO: string[] = MUNICIPIOS_POR_DEPARTAMENTO['Chocó']

/** Unidad de venta válida en el backend. */
export type Unidad = 'KG' | 'UNIDAD' | 'LITRO' | 'PAQUETE' | 'DOCENA' | 'MANOJO'

export interface OpcionUnidad {
  valor: Unidad
  etiqueta: string
}

/** Unidades con nombres fáciles de entender. */
export const UNIDADES: OpcionUnidad[] = [
  { valor: 'KG', etiqueta: 'Kilo' },
  { valor: 'UNIDAD', etiqueta: 'Unidad' },
  { valor: 'LITRO', etiqueta: 'Litro' },
  { valor: 'PAQUETE', etiqueta: 'Paquete' },
  { valor: 'DOCENA', etiqueta: 'Docena' },
  { valor: 'MANOJO', etiqueta: 'Manojo' },
]

/** Etiqueta amigable para una unidad cualquiera (con respaldo). */
export function etiquetaUnidad(unidad: string): string {
  return UNIDADES.find((u) => u.valor === unidad)?.etiqueta ?? unidad
}

export type Alcance = 'LOCAL' | 'NACIONAL' | 'AMBOS'

export interface OpcionAlcance {
  valor: Alcance
  etiqueta: string
  descripcion: string
}

/** Alcances de venta con explicación sencilla. */
export const ALCANCES: OpcionAlcance[] = [
  {
    valor: 'LOCAL',
    etiqueta: 'Solo en mi zona',
    descripcion: 'Vendes a personas cerca de ti.',
  },
  {
    valor: 'NACIONAL',
    etiqueta: 'Todo el país',
    descripcion: 'Envías tu producto a cualquier parte de Colombia.',
  },
  {
    valor: 'AMBOS',
    etiqueta: 'Ambos',
    descripcion: 'Vendes en tu zona y también a todo el país.',
  },
]

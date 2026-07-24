// Utilitario de caché en memoria ultra-rápido con TTL e invalidación por tags
// Ideal para acelerar endpoints de lectura frecuente (catálogos, hoteles, tours)
// respondiendo en < 5ms sin sobrecargar la base de datos PostgreSQL en Neon.

class MemoryCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Obtiene un valor o ejecuta la función generadora si no está en caché.
   * @param {string} key - Clave única de la consulta.
   * @param {number} ttlMs - Tiempo de vida en milisegundos (ej. 60000 para 1 min).
   * @param {Function} fetcher - Función asíncrona que consulta la BD si hay miss.
   * @returns {Promise<any>}
   */
  async getOrSet(key, ttlMs, fetcher) {
    const cached = this.cache.get(key);
    const ahora = Date.now();

    if (cached && cached.expiraAt > ahora) {
      return cached.val;
    }

    const val = await fetcher();
    this.cache.set(key, {
      val,
      expiraAt: ahora + ttlMs,
    });

    return val;
  }

  /**
   * Invalida claves que coincidan con un prefijo o expresión.
   * @param {string} prefix - Prefijo de claves a invalidar (ej. "productos:").
   */
  invalidatePrefix(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpia toda la memoria de caché.
   */
  clear() {
    this.cache.clear();
  }
}

const cacheGlobal = new MemoryCache();

module.exports = cacheGlobal;

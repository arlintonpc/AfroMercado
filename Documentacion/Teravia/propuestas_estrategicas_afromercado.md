# PROPUESTAS ESTRATÉGICAS Y VISIÓN DE PRODUCTO: AFROMERCADO

> **Perspectiva:** Visión de Fundador / Director de Producto (CPO).  
> **Objetivo:** Maximizar el valor percibido, la frecuencia de uso, la rentabilidad y la simplicidad técnica, eliminando lo que genera fricción o dispersión.

---

## 💡 Declaración de Fundador: El Problema de la "SuperApp"

Si AfroMercado fuera **mi propio proyecto**, mi principal preocupación hoy sería la **dispersión de foco**.

Actualmente la plataforma intenta ser a la vez: *MercadoLibre (Tienda), Rappi (Express), Airbnb (Hoteles), Viator (Tours), Uber (Transporte), Computrabajo (Empleos), FincaRaíz (Inmuebles) y Facebook (Cultura)*.

Abarcar 13 verticales desde el inicio provoca tres grandes riesgos:
1. **Confusión para el usuario:** El visitante no sabe si entra a comprar un chontaduro, alquilar una casa o buscar empleo.
2. **Deuda técnica masiva:** Mantener 93 tablas de base de datos y 350 endpoints cuando el equipo o los recursos son finitos ahoga el ritmo de innovación.
3. **Pérdida de la ventaja competitiva real:** La verdadera magia de AfroMercado radica en el **Territorio, la Cultura, el Turismo y la Gastronomía del Pacífico/Chocó**.

---

## ✂️ 1. LO QUE RECOMIENDO ELIMINAR O CONGELAR (Sin Aportar Valor Real Hoy)

### 🔴 A. Módulo de Bienes Raíces (Inmuebles)
* **Por qué eliminarlo:** El ciclo de venta de una propiedad (casa, finca) dura meses y requiere trámites legales complejos, promesas de compraventa y atención personalizada fuera de la app. Poner inmuebles al lado de un plato de arroz con coco le quita seriedad al módulo inmobiliario y resta frescura al e-commerce.
* **Propuesta:** **Remover del menú principal**. Si en el futuro se quiere ofrecer fincas turísticas, deben integrarse dentro del módulo de **Hoteles/Alojamientos**.

### 🔴 B. Módulo General de Empleo (Bolsa de Trabajo)
* **Por qué eliminarlo:** Competir contra LinkedIn o Computrabajo no agrega valor a la comunidad si las vacantes son escasas. Almacenar hojas de vida (CVs) genera responsabilidades pesadas de protección de datos personales (Habeas Data).
* **Propuesta:** Transformar "Empleo" en un sub-módulo exclusivo de **"Talento Local / Servicios Tradicionales"** (ej. contratar un guía turístico local, una sabedora ancestral o un motorista).

### 🔴 C. Sistema de Publicidad Propio (Ads Engine Complex)
* **Por qué congelarlo:** Construir un servidor de anuncios propio (\`CampanaPublicitaria\`, \`AnuncioUbicacion\`, \`MetricaPublicitaria\`) solo tiene sentido con más de 100,000 usuarios activos mensuales. Hoy en día genera código complejo y poco uso real.
* **Propuesta:** Reemplazar el sistema de Ads por **"Comercios Destacados"** (patrocinios simples de tarifa fija mensual para aparecer primero en la lista).

### 🔴 D. API de Datos Abiertos (\`/datos-abiertos\`)
* **Por qué congelarlo:** La comunidad y los comerciantes necesitan vender y reservar hoy. Mantener una API pública de estadísticas públicas consume recursos de ingeniería que deberían invertirse en el checkout y la logística.

---

## 🚀 2. LO QUE RECOMIENDO POTENCIAR AL MÁXIMO (El Verdadero "Core" de Valor)

### 🟢 A. El "Combo Experiencia Pacífico" (Super-Power Único)
Ninguna plataforma del mundo (ni Airbnb, ni Booking, ni Rappi) puede ofrecer lo que AfroMercado sí:
* **La propuesta:** Permitir al turista armar su **Viaje Completo en 1 Clic**:
  1. Hostería en Nuquí (Hoteles)
  2. Tour de Avistamiento de Ballenas (Tours)
  3. Pasaje en Lancha/Bote (Transporte)
  4. Gastronomía local (Express/Sabores)
* **Valor agregado:** El usuario no reserva 4 cosas por separado en páginas distintas; AfroMercado se convierte en el **Operador Turístico y Cultural Digital del Pacífico**.

### 🟢 B. Integración Nativa con WhatsApp (Crucial para la Región)
* **Realidad del Territorio:** En muchos municipios del Chocó y el Pacífico la conectividad 4G es intermitente, pero todos usan WhatsApp (con paquetes de datos de chats ilimitados).
* **Propuesta:** Incorporar la opción **"Pedir/Consultar por WhatsApp"** con un resumen del carrito auto-generado (ej. *"Hola Restaurante X, quiero confirmar mi pedido de 2 Cazuelas por $45.000 verificado en AfroMercado"*). Esto **multiplicará por 3 las conversiones reales** cuando la red falle.

### 🟢 C. Historia y Origen del Producto (Storytelling & Sello Afro)
* **Valor agregado:** La gente no compra una artesanía en AfroMercado solo por el objeto; compra la **historia del artesano** y el impacto comunitario.
* **Propuesta:** Agregar la etiqueta **"Producido por [Nombre del Sabedor/Artesano]"** con un mini-perfil en cada producto de la Tienda y del Campo.

### 🟢 D. Modo "PWA Offline-First" (App Ligera para Territorio)
* **Propuesta:** Asegurar que la app guarde los menús, tiquetes de transporte y reservas en el teléfono del usuario para que funcionen **incluso si el usuario se queda sin señal** en medio del mar o la selva.

---

## 🎨 3. PROPUESTA DE REDISEÑO DE LA NAVEGACIÓN Y MENÚS

Para simplificar visualmente la aplicación (como se observa en las capturas de pantalla), propongo condensar la plataforma en **4 pilares claros**:

```
[ AFROMERCADO ]
  ├── 🍽️ Sabores & Gastronomía (Delivery & Restaurantes)
  ├── 🌴 Experiencias & Turismo (Hoteles + Tours + Transporte unificados)
  ├── 🛍️ Mercado & Artesanías (Productos del Campo y Artesanales)
  └── 🎭 Red Cultural & Eventos (Comunidad, Música y Agenda)
```

> **Resultado:** Pasamos de un menú sobrecargado con 10-13 botones confusos a una interfaz limpia, intuitiva y enfocada de 4 categorías principales.

---

## 📋 4. MATRIZ DE DECISIÓN: QUÉ HACER AHORA MISMO

| Acción | Módulo / Funcionalidad | Razón Estratégica |
| :--- | :--- | :--- |
| **❌ OCULTAR** | Bienes Raíces, Bolsa de Empleo General, Ads Engine | Generan dispersión, baja conversión y sobrecarga técnica. |
| **⭐ REFACTORIZAR** | Hoteles + Tours + Transporte | Unificar en un solo flujo de "Arma tu Viaje al Pacífico". |
| **⚡ OPTIMIZAR** | Gastronomía (Express) | Potenciar la alta frecuencia de compra con la UX Premium y WhatsApp. |
| **🔥 CREAR** | Botón "Pedido por WhatsApp" & Perfil de Origen del Artesano | Incrementan la conversión real en territorio y la identidad de marca. |

---

## Conclusión de Fundador

Si simplificamos la plataforma quitando el ruido secundario (inmuebles, empleos, publicidad compleja) y nos concentramos en ser **los mejores en Gastronomía + Turismo Unificado + Artesanías con Identidad**, AfroMercado no solo será una plataforma hermosa, sino un **negocio altamente rentable, fácil de mantener y con un impacto social gigantesco**.

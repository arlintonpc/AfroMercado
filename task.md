# Backend Refactor for Teravia Ads

- [x] Refactor `campana.controller.js` to use `CampanaPublicitaria` and `AnuncioUbicacion`.
- [x] Refactor `publicidad.controller.js` to create ads with the new models in `convertirAdmin`.
  - [x] Create `CampanaPublicitaria`.
  - [x] Create `AnuncioUbicacion` related to it.
  - [x] Map `PAQUETES_VISIBILIDAD` to `modulo = 'PRODUCTOS'` and `formato = 'NATIVO'`.
  - [x] Map `BANNER_CARRUSEL` to `modulo = 'VITRINA'` and `formato = 'BANNER'`.
  - [x] Map `IRRUPTOR_BIENVENIDA` to `modulo = 'VITRINA'` and `formato = 'BANNER'`.
  - [x] Map `VIDEO_HISTORIA` to `modulo = 'VITRINA'` and `formato = 'VIDEO'`.
- [x] Refactor `cultura.service.js` to query video ads using `AnuncioUbicacion` (`modulo = 'VITRINA'`, `formato = 'VIDEO'`).
- [x] Refactor `visibilidad.repository.js` to map `visibilidades` to `AnuncioUbicacion` and `CampanaPublicitaria` with `PRODUCTOS` and `NATIVO` formats.
- [x] Refactor `visibilidad.service.js` to support the new database structure and logic.

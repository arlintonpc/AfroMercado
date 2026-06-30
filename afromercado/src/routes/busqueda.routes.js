const express = require('express')
const router = express.Router()
const prisma = require('../config/prisma')

// GET /busqueda?q=texto&limite=5
router.get('/', async (req, res, next) => {
  try {
    const { q = '', limite = 5 } = req.query
    const texto = String(q).trim()
    if (texto.length < 2) {
      return res.json({ ok: true, data: { productos: [], hoteles: [], tours: [], transportes: [] } })
    }

    const lim = Math.min(Number(limite), 8)
    const where = { contains: texto, mode: 'insensitive' }

    const [productos, hoteles, tours, transportes] = await Promise.all([
      prisma.producto.findMany({
        where: { activo: true, nombre: where },
        take: lim,
        select: {
          id: true, nombre: true, precio: true, fotos: true,
          comercio: { select: { municipio: true } },
        },
      }),
      prisma.configHotel.findMany({
        where: {
          activo: true,
          OR: [
            { comercio: { nombre: where } },
            { comercio: { municipio: where } },
          ],
        },
        take: lim,
        select: {
          id: true,
          comercio: { select: { nombre: true, municipio: true } },
          habitaciones: { take: 1, select: { fotos: true, precioPorNoche: true } },
        },
      }),
      prisma.configTour.findMany({
        where: { activo: true, nombre: where },
        take: lim,
        select: {
          id: true, nombre: true, precioPersona: true, fotos: true,
          comercio: { select: { municipio: true } },
        },
      }),
      prisma.configTransporte.findMany({
        where: { activo: true, nombre: where },
        take: lim,
        select: {
          id: true, nombre: true, tipo: true, fotos: true,
          comercio: { select: { municipio: true } },
        },
      }),
    ])

    res.json({ ok: true, data: { productos, hoteles, tours, transportes } })
  } catch (err) {
    next(err)
  }
})

module.exports = router

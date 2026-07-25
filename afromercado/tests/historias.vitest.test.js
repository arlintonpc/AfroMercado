import { describe, it, expect } from "vitest";

const CulturaService = require("../src/services/cultura.service");
const CulturaRepository = require("../src/repositories/cultura.repository");

describe("Pruebas: Historias Efímeras 24h (Servicio y Expiración)", () => {
  it("crearHistoria() rechaza llamadas de usuarios no autenticados", async () => {
    await expect(CulturaService.crearHistoria(null, { mediaUrl: "http://example.com/foto.jpg" }))
      .rejects.toThrow("Debes iniciar sesión para publicar una historia");
  });

  it("crearHistoria() rechaza si no se provee foto o video", async () => {
    const usuario = { id: 10, nombre: "Test User" };
    await expect(CulturaService.crearHistoria(usuario, { mediaUrl: "" }))
      .rejects.toThrow("La historia debe contener una imagen o video");
  });

  it("crearHistoria() calcula expiraAt a 24 horas exactas en el futuro", async () => {
    const usuario = { id: 10, nombre: "Test User" };
    const datos = {
      mediaUrl: "http://cloudinary.com/foto_test.jpg",
      mediaTipo: "FOTO",
      texto: "Probando historias efímeras",
      fondoColor: "#1B4332",
    };

    const mockCreada = {
      id: 99,
      autorId: usuario.id,
      mediaUrl: datos.mediaUrl,
      mediaTipo: "FOTO",
      duracionSegundos: 5,
      texto: datos.texto,
      fondoColor: datos.fondoColor,
      vistasCount: 0,
      expiraAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    const originalCrear = CulturaRepository.crearHistoria;
    CulturaRepository.crearHistoria = async (d) => {
      expect(d.autorId).toBe(usuario.id);
      expect(d.mediaUrl).toBe(datos.mediaUrl);
      const diffHoras = (d.expiraAt.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(diffHoras).toBeGreaterThan(23.9);
      expect(diffHoras).toBeLessThanOrEqual(24.01);
      return mockCreada;
    };

    try {
      const res = await CulturaService.crearHistoria(usuario, datos);
      expect(res.id).toBe(99);
      expect(res.duracionSegundos).toBe(5);
    } finally {
      CulturaRepository.crearHistoria = originalCrear;
    }
  });

  it("registrarVistaHistoria() rechaza IDs de historia inválidos", async () => {
    await expect(CulturaService.registrarVistaHistoria("abc", 10, "session_123"))
      .rejects.toThrow("ID de historia no válido");
  });

  it("registrarVistaHistoria() no cuenta una historia vencida", async () => {
    const originalBuscar = CulturaRepository.buscarHistoriaPorId;
    CulturaRepository.buscarHistoriaPorId = async () => ({ id: 10, expiraAt: new Date(Date.now() - 1000) });

    try {
      await expect(CulturaService.registrarVistaHistoria(10, 2, "session_123"))
        .rejects.toThrow("Historia no encontrada o vencida");
    } finally {
      CulturaRepository.buscarHistoriaPorId = originalBuscar;
    }
  });

  it("registrarVistaHistoria() registra solo historias activas", async () => {
    const originalBuscar = CulturaRepository.buscarHistoriaPorId;
    const originalRegistrar = CulturaRepository.registrarVistaHistoria;
    let vista = null;
    CulturaRepository.buscarHistoriaPorId = async () => ({ id: 10, expiraAt: new Date(Date.now() + 60_000) });
    CulturaRepository.registrarVistaHistoria = async (datos) => { vista = datos; };

    try {
      await expect(CulturaService.registrarVistaHistoria(10, 2, "session_123"))
        .resolves.toEqual({ ok: true });
      expect(vista).toEqual({ historiaId: 10, usuarioId: 2, sesionId: "session_123" });
    } finally {
      CulturaRepository.buscarHistoriaPorId = originalBuscar;
      CulturaRepository.registrarVistaHistoria = originalRegistrar;
    }
  });

  it("eliminarHistoria() rechaza si la historia no existe", async () => {
    const usuario = { id: 10, rol: "COMPRADOR" };
    const originalBuscar = CulturaRepository.buscarHistoriaPorId;
    CulturaRepository.buscarHistoriaPorId = async () => null;

    try {
      await expect(CulturaService.eliminarHistoria(usuario, 999))
        .rejects.toThrow("Historia no encontrada");
    } finally {
      CulturaRepository.buscarHistoriaPorId = originalBuscar;
    }
  });

  it("eliminarHistoria() rechaza si el usuario no es el autor ni admin", async () => {
    const usuario = { id: 10, rol: "COMPRADOR" };
    const historia = { id: 50, autorId: 99, comercio: null };

    const originalBuscar = CulturaRepository.buscarHistoriaPorId;
    CulturaRepository.buscarHistoriaPorId = async () => historia;

    try {
      await expect(CulturaService.eliminarHistoria(usuario, 50))
        .rejects.toThrow("No tienes permiso para eliminar esta historia");
    } finally {
      CulturaRepository.buscarHistoriaPorId = originalBuscar;
    }
  });

  it("eliminarHistoria() permite al autor o admin eliminar su propia historia", async () => {
    const usuarioAutor = { id: 10, rol: "COMPRADOR" };
    const historia = { id: 50, autorId: 10, comercio: null };

    const originalBuscar = CulturaRepository.buscarHistoriaPorId;
    const originalEliminar = CulturaRepository.eliminarHistoria;

    let eliminadaId = null;
    CulturaRepository.buscarHistoriaPorId = async () => historia;
    CulturaRepository.eliminarHistoria = async (id) => { eliminadaId = id; };

    try {
      const res = await CulturaService.eliminarHistoria(usuarioAutor, 50);
      expect(res.ok).toBe(true);
      expect(eliminadaId).toBe(50);
    } finally {
      CulturaRepository.buscarHistoriaPorId = originalBuscar;
      CulturaRepository.eliminarHistoria = originalEliminar;
    }
  });
});

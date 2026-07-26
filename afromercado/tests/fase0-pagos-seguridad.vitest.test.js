import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = require("../src/config/prisma");
const PagoRepository = require("../src/repositories/pago.repository");
const PedidoRepository = require("../src/repositories/pedido.repository");
const VisibilidadRepository = require("../src/repositories/visibilidad.repository");
const PaymentConfigService = require("../src/services/payment-config.service");
const NotificacionService = require("../src/services/notificacion.service");
const FacturacionService = require("../src/services/facturacion.service");
const FidelizacionService = require("../src/services/fidelizacion.service");
const PagoPublicidadService = require("../src/services/pago-publicidad.service");
const providerFactory = require("../src/services/payments/provider-factory");

const USUARIO_A = "usuario-a";
const USUARIO_B = "usuario-b";
const PEDIDO_A = 1001;
const PEDIDO_B = 2002;
const IDEMPOTENCY_KEY = "idem-compartida-entre-pedidos";

let eventoWebhook;
let pagoDigitalExistente;
let pagoWebhook;
let bloqueosPedido;
let actualizacionesStock;
let liberacionesReserva;
let actualizacionesPedido;
let actualizacionesEvento;

const proveedorFake = {
  nombre: "SANDBOX",
  interpretarWebhook: vi.fn(async () => eventoWebhook),
  dispersar: vi.fn(async () => []),
};

providerFactory.normalizarProveedor = (nombre) =>
  String(nombre || "SANDBOX").trim().toUpperCase();
providerFactory.obtenerProveedor = () => proveedorFake;
providerFactory.obtenerProveedorConfigurado = async () => ({
  nombre: "SANDBOX",
  provider: proveedorFake,
});

const PagoService = require("../src/services/pago.service");
const PagoDigitalService = require("../src/services/pago-digital.service");
const PagoController = require("../src/controllers/pago.controller");
const AdminService = require("../src/services/admin.service");
const ReintentosDispersionJob = require("../src/jobs/reintentar-dispersiones.job");
const { ErrorProhibido, ErrorValidacion } = require("../src/utils/errores");

function pedido(overrides = {}) {
  return {
    id: PEDIDO_A,
    compradorId: USUARIO_A,
    estado: "PENDIENTE_PAGO",
    total: 50000,
    subPedidos: [],
    ...overrides,
  };
}

function pagoExistente(overrides = {}) {
  return {
    id: 3001,
    pedidoId: PEDIDO_A,
    monto: 50000,
    metodo: "PASARELA",
    estado: "PENDIENTE",
    proveedor: "SANDBOX",
    moneda: "COP",
    providerPaymentId: null,
    providerReference: "PED-1001-ORIGINAL",
    providerStatus: "CREATED",
    providerCheckoutUrl: "https://checkout.test/pago-a",
    providerPayload: null,
    expiraAt: null,
    confirmadoAt: null,
    notas: null,
    dispersiones: [],
    pedido: pedido(),
    ...overrides,
  };
}

function pagoConPedidoCancelado() {
  return pagoExistente({
    id: 4001,
    providerPaymentId: "pay-late-4001",
    providerReference: "PED-1001-LATE",
    pedido: pedido({
      estado: "CANCELADO",
      comprador: {
        id: USUARIO_A,
        nombre: "Comprador A",
        email: "a@example.test",
        telefono: "3000000000",
      },
      subPedidos: [
        {
          id: 5001,
          comercioId: 91,
          comercio: { id: 91, nombre: "Comercio QA" },
          items: [{ id: 6001, productoId: 701, cantidad: 2, ofertaId: null }],
        },
      ],
    }),
  });
}

async function capturarRechazo(promesa) {
  try {
    await promesa;
    return null;
  } catch (error) {
    return error;
  }
}

beforeEach(() => {
  vi.restoreAllMocks();

  eventoWebhook = null;
  pagoDigitalExistente = null;
  pagoWebhook = null;
  bloqueosPedido = 0;
  actualizacionesStock = 0;
  liberacionesReserva = 0;
  actualizacionesPedido = [];
  actualizacionesEvento = [];

  PaymentConfigService.pagosManualesHabilitados = vi.fn(async () => true);
  PedidoRepository.buscarPorId = vi.fn(async (pedidoId) =>
    Number(pedidoId) === PEDIDO_A
      ? pedido()
      : pedido({ id: PEDIDO_B, compradorId: USUARIO_B })
  );
  PedidoRepository.actualizarEstado = vi.fn(async (id, estado) => {
    actualizacionesPedido.push({ id: Number(id), estado });
    if (pagoWebhook?.pedido && Number(id) === pagoWebhook.pedido.id) {
      pagoWebhook.pedido = { ...pagoWebhook.pedido, estado };
    }
    return { id: Number(id), estado };
  });
  PagoRepository.buscarPorIdempotencyKey = vi.fn(async () => null);
  PagoRepository.buscarPorId = vi.fn(async () => pagoWebhook);
  PagoRepository.crear = vi.fn(async (datos) => ({ id: 9001, ...datos }));
  PagoRepository.actualizar = vi.fn(async (id, data) => {
    pagoWebhook = { ...pagoWebhook, ...data };
    return { id, ...pagoWebhook };
  });

  prisma.$transaction = vi.fn(async (callback) => callback(prisma));
  prisma.$queryRaw = vi.fn(async (strings) => {
    const sql = strings.join(" ");
    if (sql.includes('FROM "Pedido"') && sql.includes("FOR UPDATE")) {
      bloqueosPedido += 1;
      return [{ id: PEDIDO_A }];
    }
    if (sql.includes('UPDATE "Producto"')) {
      actualizacionesStock += 1;
      return [{
        id: 701,
        nombre: "Producto QA",
        comercioId: 91,
        stock: 8,
        stockMinimo: 0,
        stockBajoNotificadoAt: null,
      }];
    }
    return [];
  });
  prisma.$executeRaw = vi.fn(async () => {
    liberacionesReserva += 1;
    return 1;
  });

  prisma.pago = {
    findUnique: vi.fn(async ({ where }) => {
      if (where.idempotencyKey) return pagoDigitalExistente;
      if (where.id && pagoWebhook?.id === Number(where.id)) return pagoWebhook;
      return null;
    }),
    findFirst: vi.fn(async () => pagoWebhook),
    create: vi.fn(async ({ data }) => ({ id: 9100, ...data, dispersiones: [] })),
    update: vi.fn(async ({ data }) => {
      if (!pagoWebhook) return null;
      pagoWebhook = { ...pagoWebhook, ...data };
      return pagoWebhook;
    }),
  };
  prisma.pedido = {
    findUnique: vi.fn(async ({ where }) => {
      if (Number(where.id) === PEDIDO_A) return pagoWebhook?.pedido || pedido();
      if (Number(where.id) === PEDIDO_B) {
        return pedido({ id: PEDIDO_B, compradorId: USUARIO_B });
      }
      return null;
    }),
    update: vi.fn(async ({ where, data }) => {
      actualizacionesPedido.push({ id: Number(where.id), ...data });
      if (pagoWebhook?.pedido && Number(where.id) === pagoWebhook.pedido.id) {
        pagoWebhook.pedido = { ...pagoWebhook.pedido, ...data };
      }
      return { id: Number(where.id), ...data };
    }),
  };
  prisma.pagoDispersion = {
    createMany: vi.fn(async () => ({ count: 0 })),
    updateMany: vi.fn(async () => ({ count: 0 })),
    update: vi.fn(async ({ where, data }) => ({ id: where.id, ...data })),
  };
  prisma.pagoEvento = {
    create: vi.fn(async ({ data }) => ({ id: 8001, ...data })),
    update: vi.fn(async ({ where, data }) => {
      const actualizacion = { id: where.id, ...data };
      actualizacionesEvento.push(actualizacion);
      return actualizacion;
    }),
  };
  prisma.subPedido = {
    updateMany: vi.fn(async () => ({ count: 1 })),
  };
  prisma.comercio = {
    update: vi.fn(async ({ where, data }) => ({ id: where.id, ...data })),
  };
  prisma.producto = {
    update: vi.fn(async ({ where, data }) => ({ id: where.id, ...data })),
  };
  prisma.cuentaDispersionComercio = {
    findMany: vi.fn(async () => []),
  };

  VisibilidadRepository.atribuirPedidoConfirmado = vi.fn(async () => {});
  NotificacionService.pagoAprobado = vi.fn(async () => {});
  NotificacionService.dispersionFallidaAdmin = vi.fn(async () => {});
  NotificacionService.stockBajo = vi.fn(async () => {});
  FacturacionService.emitirParaReferencia = vi.fn(async () => {});
  FidelizacionService.otorgarPuntosPorCompra = vi.fn(async () => {});
  PagoPublicidadService.procesarWebhook = vi.fn(async () => null);
});

describe("Fase 0 - instrucciones de pago", () => {
  it("impide que otro usuario obtenga instrucciones del pedido", async () => {
    const error = await capturarRechazo(
      PagoService.obtenerInstruccionesPago(USUARIO_B, PEDIDO_A)
    );

    expect(error).toBeInstanceOf(ErrorProhibido);
    expect(error.statusCode).toBe(403);
  });

  it("el controlador entrega la identidad autenticada al servicio", async () => {
    const spy = vi
      .spyOn(PagoService, "obtenerInstruccionesPago")
      .mockResolvedValue({ pedidoId: PEDIDO_A });
    const req = {
      usuario: { id: USUARIO_B },
      params: { pedidoId: String(PEDIDO_A) },
    };
    const res = { json: vi.fn() };
    const next = vi.fn();

    await PagoController.instrucciones(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(USUARIO_B, String(PEDIDO_A));
  });
});

describe("Fase 0 - aislamiento de idempotency keys", () => {
  it("pago manual no devuelve una clave ligada a otro pedido", async () => {
    PagoRepository.buscarPorIdempotencyKey = vi.fn(async () =>
      pagoExistente({ metodo: "NEQUI" })
    );

    const error = await capturarRechazo(
      PagoService.crearPago(USUARIO_B, {
        pedidoId: PEDIDO_B,
        metodo: "NEQUI",
        referencia: "QA-B",
        idempotencyKey: IDEMPOTENCY_KEY,
      })
    );

    expect(error).not.toBeNull();
    expect(error.statusCode).toBe(409);
  });

  it("pago manual retorna el original para la misma solicitud", async () => {
    const existente = pagoExistente({ metodo: "NEQUI" });
    PagoRepository.buscarPorIdempotencyKey = vi.fn(async () => existente);

    const resultado = await PagoService.crearPago(USUARIO_A, {
      pedidoId: PEDIDO_A,
      metodo: "NEQUI",
      referencia: "QA-A",
      idempotencyKey: IDEMPOTENCY_KEY,
    });

    expect(resultado).toBe(existente);
    expect(PagoRepository.crear).not.toHaveBeenCalled();
  });

  it("pago manual recupera el original ante una carrera de unicidad", async () => {
    const existente = pagoExistente({ metodo: "NEQUI" });
    PagoRepository.buscarPorIdempotencyKey = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existente);
    const errorUnicidad = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    });
    PagoRepository.crear = vi.fn(async () => {
      throw errorUnicidad;
    });

    const resultado = await PagoService.crearPago(USUARIO_A, {
      pedidoId: PEDIDO_A,
      metodo: "NEQUI",
      referencia: "QA-A",
      idempotencyKey: IDEMPOTENCY_KEY,
    });

    expect(resultado).toBe(existente);
    expect(PagoRepository.buscarPorIdempotencyKey).toHaveBeenCalledTimes(2);
  });

  it("checkout digital no devuelve una clave ligada a otro pedido", async () => {
    pagoDigitalExistente = pagoExistente();

    const error = await capturarRechazo(
      PagoDigitalService.crearCheckout(USUARIO_B, {
        pedidoId: PEDIDO_B,
        idempotencyKey: IDEMPOTENCY_KEY,
      })
    );

    expect(error).not.toBeNull();
    expect(error.statusCode).toBe(409);
  });

  it("checkout digital retorna el original para la misma solicitud", async () => {
    pagoDigitalExistente = pagoExistente();

    const resultado = await PagoDigitalService.crearCheckout(USUARIO_A, {
      pedidoId: PEDIDO_A,
      idempotencyKey: IDEMPOTENCY_KEY,
    });

    expect(resultado.id).toBe(pagoDigitalExistente.id);
    expect(prisma.pago.create).not.toHaveBeenCalled();
  });

  it("checkout digital recupera el original ante una carrera de unicidad", async () => {
    const existente = pagoExistente();
    let consultasIdempotencia = 0;
    prisma.pago.findUnique = vi.fn(async ({ where }) => {
      if (where.idempotencyKey) {
        consultasIdempotencia += 1;
        return consultasIdempotencia === 1 ? null : existente;
      }
      return null;
    });
    const errorUnicidad = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    });
    prisma.pago.create = vi.fn(async () => {
      throw errorUnicidad;
    });

    const resultado = await PagoDigitalService.crearCheckout(USUARIO_A, {
      pedidoId: PEDIDO_A,
      idempotencyKey: IDEMPOTENCY_KEY,
    });

    expect(resultado.id).toBe(existente.id);
    expect(consultasIdempotencia).toBe(2);
  });
});

describe("Fase 0 - webhook tardio sobre pedido cancelado", () => {
  it("registra conciliacion sin confirmar pedido ni descontar stock", async () => {
    pagoWebhook = pagoConPedidoCancelado();
    eventoWebhook = {
      eventoId: "evt-approved-late-4001",
      tipo: "payment.status.changed",
      estado: "APPROVED",
      providerPaymentId: pagoWebhook.providerPaymentId,
      providerReference: pagoWebhook.providerReference,
      payload: {
        data: {
          transaction: {
            amount_in_cents: Number(pagoWebhook.monto) * 100,
          },
        },
      },
      firma: "firma-qa",
    };

    const resultado = await PagoDigitalService.procesarWebhook("SANDBOX", {
      body: eventoWebhook.payload,
      headers: {},
      rawBody: JSON.stringify(eventoWebhook.payload),
    });

    expect(resultado).toMatchObject({
      ok: true,
      procesado: true,
      requiereConciliacion: true,
    });
    expect(bloqueosPedido).toBe(1);
    expect(actualizacionesStock).toBe(0);
    expect(actualizacionesPedido).not.toContainEqual(
      expect.objectContaining({ id: PEDIDO_A, estado: "CONFIRMADO" })
    );
    expect(pagoWebhook.pedido.estado).toBe("CANCELADO");
    expect(pagoWebhook.estado).toBe("VERIFICANDO");
    expect(pagoWebhook.notas).toMatch(/requiere conciliacion/i);
    expect(VisibilidadRepository.atribuirPedidoConfirmado).not.toHaveBeenCalled();
    expect(proveedorFake.dispersar).not.toHaveBeenCalled();
    expect(actualizacionesEvento.at(-1)).toMatchObject({
      procesado: true,
      errorMensaje: expect.stringMatching(/requiere conciliacion/i),
    });
  });

  it("concilia una aprobacion tardia aunque el pago ya estuviera FALLIDO", async () => {
    pagoWebhook = pagoConPedidoCancelado();
    pagoWebhook.estado = "FALLIDO";
    pagoWebhook.pedido.estado = "PAGO_FALLIDO";
    eventoWebhook = {
      eventoId: "evt-approved-after-failure-4001",
      tipo: "payment.status.changed",
      estado: "APPROVED",
      providerPaymentId: pagoWebhook.providerPaymentId,
      providerReference: pagoWebhook.providerReference,
      payload: {
        data: {
          transaction: {
            amount_in_cents: Number(pagoWebhook.monto) * 100,
          },
        },
      },
      firma: "firma-qa",
    };

    const resultado = await PagoDigitalService.procesarWebhook("SANDBOX", {
      body: eventoWebhook.payload,
      headers: {},
      rawBody: JSON.stringify(eventoWebhook.payload),
    });

    expect(resultado).toMatchObject({
      ok: true,
      procesado: true,
      requiereConciliacion: true,
    });
    expect(pagoWebhook.estado).toBe("VERIFICANDO");
    expect(pagoWebhook.pedido.estado).toBe("PAGO_FALLIDO");
    expect(actualizacionesStock).toBe(0);
    expect(proveedorFake.dispersar).not.toHaveBeenCalled();
  });

  it("no procesa identificadores que apuntan a pagos diferentes", async () => {
    eventoWebhook = {
      eventoId: "evt-identificadores-cruzados",
      tipo: "payment.status.changed",
      estado: "APPROVED",
      providerPaymentId: "pay-de-pedido-a",
      providerReference: "PEDIDO-B-REFERENCIA",
      payload: {},
      firma: "firma-qa",
    };
    prisma.pago.findFirst = vi
      .fn()
      .mockResolvedValueOnce(pagoExistente({ id: 4101 }))
      .mockResolvedValueOnce(pagoExistente({ id: 4102 }));

    const resultado = await PagoDigitalService.procesarWebhook("SANDBOX", {
      body: eventoWebhook.payload,
      headers: {},
      rawBody: JSON.stringify(eventoWebhook.payload),
    });

    expect(resultado).toMatchObject({
      ok: false,
      procesado: true,
      error: expect.stringMatching(/pagos diferentes/i),
    });
    expect(actualizacionesStock).toBe(0);
    expect(VisibilidadRepository.atribuirPedidoConfirmado).not.toHaveBeenCalled();
    expect(actualizacionesEvento.at(-1)).toMatchObject({
      procesado: true,
      errorMensaje: expect.stringMatching(/pagos diferentes/i),
    });
  });

  it("rechaza una referencia desconocida que contradice el pago hallado por id", async () => {
    pagoWebhook = pagoExistente({
      id: 4201,
      providerPaymentId: "pay-conocido",
      providerReference: "REFERENCIA-CORRECTA",
    });
    eventoWebhook = {
      eventoId: "evt-referencia-contradictoria",
      tipo: "payment.status.changed",
      estado: "APPROVED",
      providerPaymentId: pagoWebhook.providerPaymentId,
      providerReference: "REFERENCIA-DESCONOCIDA",
      payload: {},
      firma: "firma-qa",
    };
    prisma.pago.findFirst = vi
      .fn()
      .mockResolvedValueOnce(pagoWebhook)
      .mockResolvedValueOnce(null);

    const resultado = await PagoDigitalService.procesarWebhook("SANDBOX", {
      body: eventoWebhook.payload,
      headers: {},
      rawBody: JSON.stringify(eventoWebhook.payload),
    });

    expect(resultado).toMatchObject({
      ok: false,
      procesado: true,
      error: expect.stringMatching(/referencia.+no coincide/i),
    });
    expect(actualizacionesStock).toBe(0);
    expect(actualizacionesEvento.at(-1)).toMatchObject({
      procesado: true,
      errorMensaje: expect.stringMatching(/referencia.+no coincide/i),
    });
  });
});

describe("Fase 0 - reintentos de dispersion", () => {
  function dispersion(overrides = {}) {
    return {
      id: 6101,
      pagoId: 3001,
      comercioId: 91,
      estado: "PENDIENTE",
      intentosFallidos: 0,
      proximoReintentoAt: null,
      cuentaDispersion: {},
      ...overrides,
    };
  }

  it("cuenta y programa una respuesta FALLIDA del proveedor", async () => {
    const item = dispersion();
    pagoWebhook = pagoExistente({
      estado: "CONFIRMADO",
      dispersiones: [item],
    });
    prisma.pagoDispersion.updateMany = vi.fn(async () => ({ count: 1 }));
    proveedorFake.dispersar = vi.fn(async () => [{
      id: item.id,
      estado: "FALLIDA",
      providerStatus: "REJECTED",
      errorMensaje: "Cuenta rechazada",
    }]);
    const antes = Date.now();

    const error = await capturarRechazo(
      PagoDigitalService.ejecutarDispersiones(pagoWebhook.id)
    );

    expect(error?.message).toMatch(/no se completaron/i);
    expect(prisma.pagoDispersion.update).toHaveBeenCalledWith({
      where: { id: item.id },
      data: expect.objectContaining({
        estado: "FALLIDA",
        intentosFallidos: { increment: 1 },
        proximoReintentoAt: expect.any(Date),
        errorMensaje: "Cuenta rechazada",
      }),
    });
    const proximoReintento =
      prisma.pagoDispersion.update.mock.calls[0][0].data.proximoReintentoAt;
    expect(proximoReintento.getTime() - antes).toBeGreaterThanOrEqual(5 * 60 * 1000);
    expect(proximoReintento.getTime() - antes).toBeLessThan(5 * 60 * 1000 + 1000);
  });

  it("detiene los reintentos automaticos al contabilizar el quinto fallo", async () => {
    const item = dispersion({ intentosFallidos: 4, estado: "FALLIDA" });
    pagoWebhook = pagoExistente({
      estado: "CONFIRMADO",
      dispersiones: [item],
    });
    prisma.pagoDispersion.updateMany = vi.fn(async () => ({ count: 1 }));
    proveedorFake.dispersar = vi.fn(async () => [{
      id: item.id,
      estado: "FALLIDA",
      providerStatus: "REJECTED",
      errorMensaje: "Quinto rechazo",
    }]);

    await capturarRechazo(
      PagoDigitalService.ejecutarDispersiones(pagoWebhook.id)
    );

    expect(prisma.pagoDispersion.update).toHaveBeenCalledWith({
      where: { id: item.id },
      data: expect.objectContaining({
        estado: "FALLIDA",
        intentosFallidos: { increment: 1 },
        proximoReintentoAt: null,
      }),
    });
  });

  it("procesa cada dispersion por separado para no mezclar claves de lote", async () => {
    const una = dispersion({ id: 6101 });
    const dos = dispersion({ id: 6102 });
    pagoWebhook = pagoExistente({
      estado: "CONFIRMADO",
      dispersiones: [una, dos],
    });
    prisma.pagoDispersion.updateMany = vi.fn(async () => ({ count: 2 }));
    proveedorFake.dispersar = vi.fn(async ({ dispersiones }) =>
      dispersiones.map((item) => ({
        id: item.id,
        estado: "CONFIRMADA",
        providerStatus: "CONFIRMED",
      }))
    );

    const resultado = await PagoDigitalService.ejecutarDispersiones(pagoWebhook.id);

    expect(resultado).toHaveLength(2);
    expect(proveedorFake.dispersar).toHaveBeenCalledTimes(2);
    expect(proveedorFake.dispersar.mock.calls[0][0].dispersiones).toHaveLength(1);
    expect(proveedorFake.dispersar.mock.calls[1][0].dispersiones).toHaveLength(1);
  });

  it("detiene el reintento automatico cuando el envio queda incierto", async () => {
    const item = dispersion();
    pagoWebhook = pagoExistente({
      estado: "CONFIRMADO",
      dispersiones: [item],
    });
    prisma.pagoDispersion.updateMany = vi.fn(async () => ({ count: 1 }));
    proveedorFake.dispersar = vi.fn(async () => {
      const error = new Error("Conexion interrumpida");
      error.envioIncierto = true;
      throw error;
    });

    const error = await capturarRechazo(
      PagoDigitalService.ejecutarDispersiones(pagoWebhook.id)
    );

    expect(error?.requiereConciliacionDispersion).toBe(true);
    expect(prisma.pagoDispersion.update).toHaveBeenCalledWith({
      where: { id: item.id },
      data: expect.objectContaining({
        estado: "ENVIADA",
        providerStatus: "ENVIO_INCIERTO",
        intentosFallidos: { increment: 1 },
        proximoReintentoAt: null,
      }),
    });
  });

  it("un fallo al guardar una respuesta aprobada conserva el mismo intento", async () => {
    const item = dispersion();
    pagoWebhook = pagoExistente({
      estado: "CONFIRMADO",
      dispersiones: [item],
    });
    prisma.pagoDispersion.updateMany = vi.fn(async () => ({ count: 1 }));
    proveedorFake.dispersar = vi.fn(async () => [{
      id: item.id,
      estado: "CONFIRMADA",
      providerStatus: "CONFIRMED",
      providerTransferId: "transfer-6101",
    }]);
    prisma.pagoDispersion.update = vi.fn(async () => {
      throw new Error("base de datos no disponible");
    });

    const error = await capturarRechazo(
      PagoDigitalService.ejecutarDispersiones(pagoWebhook.id)
    );

    expect(error?.message).toBe("base de datos no disponible");
    expect(proveedorFake.dispersar).toHaveBeenCalledTimes(1);
    expect(prisma.pagoDispersion.update).toHaveBeenCalledTimes(1);
    expect(prisma.pagoDispersion.update.mock.calls[0][0].data).toMatchObject({
      estado: "CONFIRMADA",
      providerStatus: "CONFIRMED",
      proximoReintentoAt: null,
    });
    expect(prisma.pagoDispersion.update.mock.calls[0][0].data)
      .not.toHaveProperty("intentosFallidos");
  });

  it("el job no vuelve a incrementar un intento ya contado por el servicio", async () => {
    prisma.pagoDispersion.findMany = vi
      .fn()
      .mockResolvedValueOnce([{ id: 6101, pagoId: 3001 }])
      .mockResolvedValueOnce([{
        intentosFallidos: 1,
        providerStatus: "REJECTED",
      }]);
    prisma.pagoDispersion.updateMany = vi.fn(async () => ({ count: 0 }));
    vi.spyOn(PagoDigitalService, "ejecutarDispersiones")
      .mockRejectedValue(new Error("rechazo ya contabilizado"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await ReintentosDispersionJob.reintentarDispersionesFallidas();

    expect(prisma.pagoDispersion.updateMany).not.toHaveBeenCalled();
    expect(NotificacionService.dispersionFallidaAdmin).not.toHaveBeenCalled();
  });
});

describe("Fase 0 - rechazo administrativo", () => {
  it("no libera dos veces la reserva de un pedido ya cancelado", async () => {
    pagoWebhook = pagoConPedidoCancelado();
    pagoWebhook.metodo = "NEQUI";
    PedidoRepository.buscarPorId = vi.fn(async () => pagoWebhook.pedido);

    const resultado = await AdminService.verificarPago(77, pagoWebhook.id, {
      accion: "RECHAZAR",
      notas: "Comprobante invalido",
    });

    expect(resultado.accion).toBe("RECHAZAR");
    expect(bloqueosPedido).toBe(1);
    expect(liberacionesReserva).toBe(0);
    expect(actualizacionesPedido).not.toContainEqual(
      expect.objectContaining({ estado: "PAGO_FALLIDO" })
    );
    expect(pagoWebhook.pedido.estado).toBe("CANCELADO");
  });

  it("no permite rechazar como fallido un pago aprobado por la pasarela", async () => {
    pagoWebhook = pagoConPedidoCancelado();
    pagoWebhook.providerStatus = "APPROVED";
    PedidoRepository.buscarPorId = vi.fn(async () => pagoWebhook.pedido);

    const error = await capturarRechazo(
      AdminService.verificarPago(77, pagoWebhook.id, {
        accion: "RECHAZAR",
        notas: "Rechazo incorrecto",
      })
    );

    expect(error).toBeInstanceOf(ErrorValidacion);
    expect(error.message).toMatch(/reembolso/i);
    expect(liberacionesReserva).toBe(0);
  });
});

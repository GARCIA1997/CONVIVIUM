import fp from "fastify-plugin";

/** Error de negocio con código HTTP y código estable para el front. */
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
export const notFound = (what: string) => new AppError(404, "not_found", `${what} no encontrado`);
export const forbidden = (msg = "Sin permiso") => new AppError(403, "forbidden", msg);
export const conflict = (code: string, msg: string) => new AppError(409, code, msg);

export default fp(async (app) => {
  app.setErrorHandler((err: Error & { validation?: unknown; statusCode?: number }, req, reply) => {
    if (err instanceof AppError) return reply.status(err.status).send({ error: err.code, message: err.message });
    if (err.validation) return reply.status(400).send({ error: "validation", message: err.message });
    // Errores de cliente de Fastify y plugins (token vencido/ausente = 401, cuerpo inválido, etc.).
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      const error = err.statusCode === 401 ? "unauthorized" : "bad_request";
      return reply.status(err.statusCode).send({ error, message: err.statusCode === 401 ? "Sesión vencida o inválida" : err.message });
    }
    // Violación de integridad de Postgres (23xxx: nulos, llaves, únicos): dato inválido del cliente.
    const code = (err as { code?: string }).code;
    if (typeof code === "string" && code.startsWith("23")) {
      req.log.warn({ code, msg: err.message }, "dato rechazado por la base");
      return reply.status(code === "23505" ? 409 : 400).send({ error: code === "23505" ? "duplicate" : "invalid_data", message: "Datos inválidos o duplicados" });
    }
    req.log.error(err);
    return reply.status(500).send({ error: "internal", message: "Error interno" });
  });
});

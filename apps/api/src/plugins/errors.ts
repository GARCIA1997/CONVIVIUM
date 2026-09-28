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
export const notImplemented = () => new AppError(501, "not_implemented", "Endpoint definido, pendiente de implementar");

export default fp(async (app) => {
  app.setErrorHandler((err: Error & { validation?: unknown }, req, reply) => {
    if (err instanceof AppError) return reply.status(err.status).send({ error: err.code, message: err.message });
    if (err.validation) return reply.status(400).send({ error: "validation", message: err.message });
    req.log.error(err);
    return reply.status(500).send({ error: "internal", message: "Error interno" });
  });
});

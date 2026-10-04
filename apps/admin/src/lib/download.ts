import { client } from "@convivium/app-shell";

/** Descarga un archivo protegido de la API (PDF, QR). */
export async function download(path: string, filename: string) {
  const res = await fetch(`/v1${path}`, { headers: { authorization: `Bearer ${client.session?.accessToken}` } });
  if (!res.ok) throw new Error("No se pudo descargar");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

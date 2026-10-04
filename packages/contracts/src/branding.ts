import { z } from "zod";

/** Tipografías disponibles para la marca del restaurante (todas de Google Fonts). */
export const BRAND_FONTS = ["Playfair Display", "Inter", "Public Sans", "Lora", "Cormorant Garamond", "DM Serif Display", "Montserrat", "Poppins", "Raleway", "Oswald", "Nunito", "Merriweather"] as const;

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color en formato #RRGGBB");

/**
 * Identidad del restaurante que compró CONVIVIUM: se aplica al menú digital, al PDF y al QR.
 * CONVIVIUM solo aparece como "Powered by CONVIVIUM" al pie.
 */
export const Branding = z.object({
  name: z.string().trim().min(1).max(60),
  slogan: z.string().trim().max(90).default(""),
  logoUrl: z.string().max(500).nullable().default(null),
  primary: Hex,
  accent: Hex,
  background: Hex,
  text: Hex,
  fontHeading: z.enum(BRAND_FONTS),
  fontBody: z.enum(BRAND_FONTS),
});
export type Branding = z.infer<typeof Branding>;
export const BrandingUpdate = Branding.omit({ logoUrl: true });

/** Valores iniciales: paleta de CONVIVIUM hasta que el restaurante configure la suya. */
export const DEFAULT_BRANDING: Omit<Branding, "name"> = {
  slogan: "", logoUrl: null, primary: "#1E2F28", accent: "#D4AF7C", background: "#EAE6DD", text: "#1A1A1A", fontHeading: "Playfair Display", fontBody: "Inter",
};

/** Logo como data URL (PNG, JPG o WebP, máx. 2 MB). SVG no se acepta: puede contener scripts. */
export const BrandLogoBody = z.object({ dataUrl: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/, "Formato no soportado: usa PNG, JPG o WebP") });

/** Contraste WCAG entre dos colores hex (1 a 21). */
export function contrastRatio(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

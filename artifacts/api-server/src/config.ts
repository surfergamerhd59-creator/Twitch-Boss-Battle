// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DEL SERVIDOR — BotMod Panel
// ══════════════════════════════════════════════════════════════════════════════
//
// Las variables de entorno tienen PRIORIDAD sobre los valores escritos aquí.
// Para Render: define las variables en el panel de Environment de tu servicio.
// Para desarrollo local: usa el archivo .env o los Secrets de Replit.
//
// Si NO usas variables de entorno, escribe tus valores directamente
// en los campos marcados con "ESCRIBE_AQUI_...".
//
// ══════════════════════════════════════════════════════════════════════════════

// ── Base de datos (PostgreSQL) ────────────────────────────────────────────────
// Formato: postgresql://USUARIO:CONTRASEÑA@HOST:PUERTO/NOMBRE_DB?sslmode=require
// Obtén este valor en: Render → tu base de datos → "Connection String"
export const DATABASE_URL: string =
  process.env["DATABASE_URL"] ?? "ESCRIBE_AQUI_DATABASE_URL";

// ── Twitch OAuth ──────────────────────────────────────────────────────────────
// Obtén estos valores en: https://dev.twitch.tv/console → tu aplicación
export const TWITCH_CLIENT_ID: string =
  process.env["TWITCH_CLIENT_ID"] ?? "ESCRIBE_AQUI_CLIENT_ID";

export const TWITCH_CLIENT_SECRET: string =
  process.env["TWITCH_CLIENT_SECRET"] ?? "";

// URI de redirección — debe coincidir EXACTAMENTE con la registrada en dev.twitch.tv
// Ejemplo: https://tu-servicio.onrender.com/api/auth/callback
export const TWITCH_REDIRECT_URI: string =
  process.env["TWITCH_REDIRECT_URI"] ?? "ESCRIBE_AQUI_REDIRECT_URI";

// ── Seguridad JWT ─────────────────────────────────────────────────────────────
// Clave secreta para firmar las sesiones — usa una cadena larga y aleatoria
export const SESSION_SECRET: string =
  process.env["SESSION_SECRET"] ?? "ESCRIBE_AQUI_SESSION_SECRET";

// ── Validación al arrancar ────────────────────────────────────────────────────
// Avisa en consola si algún valor sigue siendo un placeholder vacío.
const PLACEHOLDER_PREFIX = "ESCRIBE_AQUI_";

export function warnMissingConfig(): void {
  const fields: Record<string, string> = {
    DATABASE_URL,
    TWITCH_CLIENT_ID,
    TWITCH_CLIENT_SECRET,
    TWITCH_REDIRECT_URI,
    SESSION_SECRET,
  };

  for (const [key, val] of Object.entries(fields)) {
    if (!val || val.startsWith(PLACEHOLDER_PREFIX)) {
      console.warn(
        `⚠️  CONFIG: "${key}" no está configurado. ` +
        `Edita src/config.ts o define la variable de entorno.`
      );
    }
  }
}

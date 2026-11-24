/**
 * core/security-config · Parámetros de seguridad del inicio de sesión:
 * verificación en dos pasos (app de autenticación), bloqueo por intentos fallidos y
 * dispositivos recordados.
 */

/** Verificación en dos pasos (TOTP con app de autenticación). */
export const TWO_FACTOR_ISSUER = 'EdgeCredit';
export const TWO_FACTOR_REQUIRED = true;

/** Bloqueo temporal tras varios intentos fallidos en este dispositivo. */
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_SECONDS = 60;

/**
 * Dispositivo recordado: tras verificar el código en un dispositivo y marcar
 * «Recordar este dispositivo», no se vuelve a pedir el código en ese navegador nunca más.
 * Solo deja de valer cuando el administrador usa «Restablecer 2FA» con ese trabajador
 * (o si se borran los datos del navegador). En otro dispositivo se pide el código.
 */

/** Todo acesso passa pelo servidor, então o JavaScript do navegador não precisa ler a sessão. */
export const sessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://"),
  path: "/",
});

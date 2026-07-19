export { default } from "next-auth/middleware";

// TEMPORARY: login requirement disabled for local browsing. Restore the
// matcher below to re-enable auth on all pages.
export const config = {
  matcher: [],
};

// "/((?!login|register|api/auth|api/register|_next/static|_next/image|favicon.ico).*)",

/**
 * Routes that render WITHOUT the staff shell (no sidebar, no staff sign-in required).
 *
 *   /login                staff sign-in
 *   /supplier-portal/...  the supplier-facing portal, which has its own session
 *                         (see lib/supplier-portal-session)
 *
 * Note that /supplier-portal-admin is a staff page and is deliberately NOT public:
 * the check below only matches "/supplier-portal" itself or paths below "/supplier-portal/".
 */
export function isPublicRoute(pathname: string | null | undefined): boolean {
  if (!pathname) {
    return false;
  }

  return (
    pathname === "/login" ||
    pathname === "/supplier-portal" ||
    pathname.startsWith("/supplier-portal/")
  );
}

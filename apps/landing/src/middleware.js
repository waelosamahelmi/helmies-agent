export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/studio/:path*", "/admin/:path*", "/settings/:path*", "/api/admin/:path*"],
};

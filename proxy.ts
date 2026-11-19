import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public: the landing page, the auth screens, the health check, and the cron endpoint (it checks its own secret).
const isPublic = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/api/health", "/api/cron(.*)"]);

// Next.js 16 renamed `middleware.ts` to `proxy.ts`.
export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

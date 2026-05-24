import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Supabase's password-reset emails land users at `<site_url>/?code=<uuid>`
  // because resetPasswordForEmail's redirectTo is sometimes silently ignored.
  // Catch the `?code=` query param at the root and forward to /auth/callback,
  // which exchanges the PKCE code for a session and then routes the user to
  // /auth/reset-password where they set a new password.
  const url = request.nextUrl;
  if (url.pathname === '/' && url.searchParams.has('code')) {
    const dest = url.clone();
    dest.pathname = '/auth/callback';
    dest.searchParams.set('next', '/auth/reset-password');
    return NextResponse.redirect(dest);
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - image files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

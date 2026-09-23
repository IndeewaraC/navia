import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth token if necessary and check session state
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/signup') ||
    request.nextUrl.pathname.startsWith('/verify-otp');

  const isProtectedRoute =
    request.nextUrl.pathname.startsWith('/ledger') ||
    request.nextUrl.pathname.startsWith('/groceries') ||
    request.nextUrl.pathname.startsWith('/projects') ||
    request.nextUrl.pathname.startsWith('/profile') ||
    request.nextUrl.pathname.startsWith('/settings') ||
    request.nextUrl.pathname.startsWith('/vault');

  // Redirect unauthenticated users trying to access protected routes
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('reason', 'unauthorized');
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login/signup pages
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/ledger';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
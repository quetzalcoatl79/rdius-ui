import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const refreshToken = request.cookies.get('refresh_token');
  const isAuthPage = request.nextUrl.pathname.startsWith('/login');

  if (!refreshToken && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (refreshToken && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};

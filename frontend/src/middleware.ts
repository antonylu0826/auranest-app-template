import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/callback', '/register'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Token check happens client-side; middleware just passes through for SSR
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

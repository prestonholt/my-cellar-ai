import { signIn, auth } from '@/app/(auth)/auth';
import { isDevelopmentEnvironment } from '@/lib/constants';
import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectUrl = searchParams.get('redirectUrl') || '/';

  console.log('🔍 Checking for existing session...');

  // Try both methods to check for existing session
  const session = await auth();
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: !isDevelopmentEnvironment,
  });

  console.log('Session check:', { 
    hasSession: !!session, 
    hasToken: !!token,
    sessionUserId: session?.user?.id,
    tokenUserId: token?.id 
  });

  if (session || token) {
    console.log('✅ Existing session found, redirecting to home');
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  console.log('❌ No session found, creating new guest user');
  return signIn('guest', { redirect: true, redirectTo: redirectUrl });
}

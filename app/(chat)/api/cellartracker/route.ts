import { auth } from '@/app/(auth)/auth';
import {
  getCellarData,
  saveCellarData,
  saveCellarTrackerCredentials,
} from '@/lib/db/queries';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log('🍷 CellarTracker API called');

  const session = await auth();

  if (!session?.user?.id) {
    console.log('❌ No session found');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { username, password } = await request.json();
  console.log('📝 Credentials received:', {
    username: `${username?.substring(0, 3)}***`,
    hasPassword: !!password,
  });

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Username and password are required' },
      { status: 400 },
    );
  }

  try {
    // SECURITY: Always verify credentials first, even if we have cached data
    // We need to ensure the user has the correct password for this username

    console.log('🔐 Verifying credentials with CellarTracker...');

    // Verify credentials with CellarTracker
    const url = `https://www.cellartracker.com/xlquery.asp?User=${encodeURIComponent(
      username,
    )}&Password=${encodeURIComponent(password)}&Format=csv&Table=Inventory&Location=1`;

    console.log('🌐 Fetching from CellarTracker...');
    const response = await fetch(url);
    const responseText = await response.text();

    console.log('📊 CellarTracker response status:', response.status);
    console.log(
      '📄 CellarTracker response (first 300 chars):',
      responseText.substring(0, 300),
    );
    console.log('📏 Response length:', responseText.length);

    // Check if CellarTracker returned an error HTML response
    if (
      responseText.includes('<html>') ||
      responseText.includes('not logged into CellarTracker') ||
      responseText.includes('<body>') ||
      responseText.trim().startsWith('<')
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid CellarTracker credentials. Please check your username and password.',
        },
        { status: 401 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch data from CellarTracker' },
        { status: response.status },
      );
    }

    const csvText = responseText;

    // Check if we got valid CSV data (should have column headers)
    if (
      !csvText.includes(',') ||
      csvText.trim().length < 10 ||
      !csvText.includes('Wine')
    ) {
      return NextResponse.json(
        {
          error:
            'Invalid response from CellarTracker. Please check your credentials.',
        },
        { status: 401 },
      );
    }

    console.log('✅ Credentials verified successfully');

    // Now that credentials are verified, check if we have recent cached data for this user
    const existingData = await getCellarData(session.user.id);

    console.log('💾 Checking for cached data...', {
      hasCache: !!existingData,
      cacheSize: Array.isArray(existingData?.data)
        ? existingData.data.length
        : 0,
    });

    if (
      existingData?.data &&
      Array.isArray(existingData.data) &&
      existingData.data.length > 0
    ) {
      console.log('✅ Credentials verified, returning cached data');
      // Return cached data only after verifying credentials
      return NextResponse.json({
        data: existingData.data,
        fetchedAt: existingData.fetchedAt,
        cached: true,
      });
    }

    console.log(
      '📝 No valid cache found, parsing fresh data from CellarTracker',
    );

    // Parse CSV to JSON
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
    const wines = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i].match(/(".*?"|[^,]+)/g) || [];
        const wine: any = {};

        headers.forEach((header, index) => {
          wine[header] = values[index]?.replace(/"/g, '').trim() || '';
        });

        wines.push(wine);
      }
    }

    // Store credentials
    await saveCellarTrackerCredentials({
      userId: session.user.id,
      username,
      password,
    });

    // Store cellar data
    await saveCellarData({
      userId: session.user.id,
      data: wines,
    });

    return NextResponse.json({
      data: wines,
      fetchedAt: new Date(),
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching CellarTracker data:', error);

    // Return more specific error messages for debugging
    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Failed to process request',
          details:
            process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

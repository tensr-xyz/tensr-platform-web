import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTensrApiBaseUrl } from '@/lib/tensr-api-url';
import { devLog } from '@/lib/dev-log';

export async function GET(request: NextRequest) {
  try {
    // Get the token from cookies
    let token: string | undefined;
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('idToken')?.value;
    } catch (error) {
      // During prerendering, cookies() may reject - handle gracefully
      console.warn('Could not access cookies during prerender:', error);
    }

    if (!token) {
      console.error('No access token found in cookies');
      return NextResponse.json({ error: 'Unauthorized - No token found' }, { status: 401 });
    }

    // Extract query parameters from the request URL
    const { searchParams } = new URL(request.url);
    const context = searchParams.get('context') || 'personal';
    const organizationId = searchParams.get('organizationId');

    // Build query string
    const queryParams = new URLSearchParams();
    queryParams.append('context', context);
    if (organizationId) {
      queryParams.append('organizationId', organizationId);
    }

    // Use the same API URL as the client
    const apiUrl = getTensrApiBaseUrl();
    if (!apiUrl) {
      console.error('API URL not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const fetchUrl = `${apiUrl}/files?${queryParams.toString()}`;
    devLog('Fetching files from:', fetchUrl);

    const response = await fetch(fetchUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API response error:', response.status, errorText);
      return NextResponse.json(
        { error: `Failed to fetch files: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in files API route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

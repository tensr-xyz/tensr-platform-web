import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Get the token from cookies
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;

    if (!token) {
      console.error('No access token found in cookies');
      return NextResponse.json({ error: 'Unauthorized - No token found' }, { status: 401 });
    }

    // Use the same API URL as the client
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiUrl) {
      console.error('API URL not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    console.log('Fetching files from:', `${apiUrl}/files`);
    const response = await fetch(`${apiUrl}/files`, {
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

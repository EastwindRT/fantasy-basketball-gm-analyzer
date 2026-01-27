/**
 * Yahoo API Proxy Route
 * 
 * Server-side proxy for all Yahoo Fantasy Sports API calls.
 * This avoids CORS issues by making requests from the server.
 */

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const YAHOO_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let endpoint = searchParams.get('endpoint');
    
    // Try multiple ways to get the token (header might be lowercase or in different format)
    const authHeader = request.headers.get('authorization') || 
                      request.headers.get('Authorization') ||
                      request.headers.get('AUTHORIZATION');
    const accessToken = authHeader?.replace(/^Bearer\s+/i, '') || searchParams.get('token');

    console.log('API Route Debug:', {
      endpoint,
      hasAuthHeader: !!authHeader,
      hasToken: !!accessToken,
      allHeaders: Object.fromEntries(request.headers.entries()),
    });

    if (!endpoint) {
      console.error('Missing endpoint parameter');
      return NextResponse.json(
        { error: 'Missing endpoint parameter' },
        { status: 400 }
      );
    }

    if (!accessToken) {
      console.error('Missing access token');
      return NextResponse.json(
        { error: 'Missing access token. Please authenticate first.', details: { hasAuthHeader: !!authHeader } },
        { status: 401 }
      );
    }

    // Ensure endpoint starts with /
    if (!endpoint.startsWith('/')) {
      endpoint = `/${endpoint}`;
    }

    // Add format=json to ensure we get JSON response (Yahoo returns XML by default)
    const separator = endpoint.includes('?') ? '&' : '?';
    const fullUrl = `${YAHOO_API_BASE}${endpoint}${separator}format=json`;
    console.log('Making Yahoo API request to:', fullUrl);
    console.log('Token present:', !!accessToken, 'Token length:', accessToken?.length);

    try {
      const response = await axios.get(fullUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        validateStatus: (status) => status < 500, // Don't throw on 4xx, we'll handle it
      });

      // Log successful response for debugging
      if (endpoint.includes('users') && endpoint.includes('leagues')) {
        console.log('USER LEAGUES RESPONSE:', JSON.stringify(response.data, null, 2));
      }
      // Log standings response to debug zero stats issue
      if (endpoint.includes('/standings')) {
        console.log('STANDINGS RESPONSE:', JSON.stringify(response.data, null, 2).substring(0, 5000));
      }

      // Check if Yahoo returned an error
      if (response.status >= 400) {
        const errorData = response.data;
        console.error('Yahoo API error response:', {
          status: response.status,
          data: errorData,
          fullResponse: JSON.stringify(errorData, null, 2),
        });
        
        // Extract Yahoo's error message if available
        let yahooError = `Yahoo API returned ${response.status}`;
        if (errorData?.error?.description) {
          yahooError = errorData.error.description;
        } else if (errorData?.error?.message) {
          yahooError = errorData.error.message;
        } else if (typeof errorData === 'string') {
          yahooError = errorData;
        }
        
        throw {
          response: {
            status: response.status,
            data: errorData,
          },
          message: yahooError,
        };
      }

      return NextResponse.json(response.data);
    } catch (axiosError: any) {
      // Re-throw to be caught by outer catch
      throw axiosError;
    }
  } catch (error: any) {
    console.error('Yahoo API proxy error:', error);
    console.error('Full error details:', JSON.stringify(error, null, 2));
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'API request failed';
    const statusCode = error.response?.status || 500;
    const yahooErrorData = error.response?.data;
    
    // Try to extract Yahoo's specific error message
    if (yahooErrorData) {
      if (yahooErrorData.error?.description) {
        errorMessage = yahooErrorData.error.description;
      } else if (yahooErrorData.error?.message) {
        errorMessage = yahooErrorData.error.message;
      } else if (yahooErrorData.description) {
        errorMessage = yahooErrorData.description;
      } else if (typeof yahooErrorData === 'string') {
        errorMessage = yahooErrorData;
      }
    }
    
    if (statusCode === 401) {
      errorMessage = 'Authentication failed. Token may be expired or invalid. Please re-authenticate.';
    } else if (statusCode === 403) {
      errorMessage = 'Access denied. This may be a private league. Ensure you authenticated with an account that has access to this league.';
    } else if (statusCode === 404) {
      errorMessage = 'League not found. Check the league ID and season. The season might not exist yet (e.g., 2026 season may not be available).';
    } else if (statusCode === 400) {
      // 400 usually means bad request - could be invalid league key, season doesn't exist, etc.
      if (!errorMessage.includes('League not found') && !errorMessage.includes('season')) {
        errorMessage = `Invalid request: ${errorMessage}. Check that the league ID and season are correct. The season (e.g., 2026) might not exist yet.`;
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        status: statusCode,
        details: yahooErrorData || null,
        yahooError: yahooErrorData,
      },
      { status: statusCode }
    );
  }
}


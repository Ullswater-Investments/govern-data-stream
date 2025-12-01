import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
};

interface FiwareRequest {
  path: string;
  method?: string;
  body?: any;
  skipAuth?: boolean;
}

// Token cache to avoid requesting a new token for every request
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

const getAuthToken = async (idmHost: string, user: string, pass: string): Promise<string> => {
  const now = Date.now();
  
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && tokenExpiry > now + 300000) {
    console.log('Using cached FIWARE token');
    return cachedToken;
  }

  console.log('Requesting new FIWARE token from Keyrock');
  
  try {
    const authResponse = await fetch(`${idmHost}/v1/auth/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: user, 
        password: pass 
      })
    });

    if (!authResponse.ok) {
      throw new Error(`Keyrock authentication failed: ${authResponse.status}`);
    }

    const token = authResponse.headers.get('X-Subject-Token');
    if (!token) {
      throw new Error('No token received from Keyrock');
    }

    // Cache token for 1 hour
    cachedToken = token;
    tokenExpiry = now + 3600000;
    
    console.log('Successfully authenticated with Keyrock');
    return token;
  } catch (error) {
    console.error('Keyrock auth error:', error);
    throw error;
  }
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const FIWARE_HOST = Deno.env.get('FIWARE_HOST');
    const FIWARE_USER = Deno.env.get('FIWARE_USER');
    const FIWARE_PASS = Deno.env.get('FIWARE_PASS');
    const IDM_HOST = Deno.env.get('IDM_HOST');

    if (!FIWARE_HOST) {
      console.warn('FIWARE_HOST not configured - proxy in standby mode');
      return new Response(
        JSON.stringify({ 
          error: 'FIWARE backend not configured',
          status: 'standby',
          message: 'Configure FIWARE_HOST in Supabase secrets to enable data space connectivity'
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse request body
    const requestData: FiwareRequest = await req.json();
    const { path, method = 'GET', body, skipAuth = false } = requestData;

    console.log(`FIWARE Proxy Request: ${method} ${path}`);

    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/ld+json',
      'NGSILD-Tenant': 'procuredata' // Multi-tenant support
    };

    // Get auth token if required
    if (!skipAuth && IDM_HOST && FIWARE_USER && FIWARE_PASS) {
      try {
        const token = await getAuthToken(IDM_HOST, FIWARE_USER, FIWARE_PASS);
        headers['X-Auth-Token'] = token;
      } catch (authError) {
        console.warn('Auth failed, continuing without token:', authError);
      }
    }

    // Forward request to FIWARE
    const fiwareUrl = `${FIWARE_HOST}${path}`;
    console.log(`Forwarding to: ${fiwareUrl}`);

    const fiwareResponse = await fetch(fiwareUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseText = await fiwareResponse.text();
    let responseData;

    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseData = { rawResponse: responseText };
    }

    console.log(`FIWARE Response: ${fiwareResponse.status}`);

    return new Response(
      JSON.stringify(responseData),
      {
        status: fiwareResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('FIWARE Proxy Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        type: 'proxy_error',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

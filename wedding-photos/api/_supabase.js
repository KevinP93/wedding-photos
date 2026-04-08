const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pipbutmzxzhcetlyxfxn.supabase.co';

function getServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante.');
  }

  return serviceRoleKey;
}

function getServiceSupabase() {
  return createClient(SUPABASE_URL, getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function parseAuthToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || '';
}

async function getAuthenticatedUser(req, client) {
  const accessToken = parseAuthToken(req);
  if (!accessToken) {
    return null;
  }

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    return null;
  }

  return data.user;
}

async function getProfileById(client, userId) {
  const { data, error } = await client
    .from('profiles')
    .select('id, username, display_name, role, avatar_url')
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

module.exports = {
  SUPABASE_URL,
  getServiceSupabase,
  getAuthenticatedUser,
  getProfileById
};

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  'https://pipbutmzxzhcetlyxfxn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const ADMIN_USERNAME = normalizeUsername(process.env.ADMIN_USERNAME || 'kevadmin');
const ADMIN_DISPLAY_NAME = (process.env.ADMIN_DISPLAY_NAME || 'kevadmin').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kevadmin';
const ADMIN_EMAIL = `${ADMIN_USERNAME}@wedding-photos.example.com`;
const LEGACY_ADMIN_EMAIL = `${ADMIN_USERNAME}@wedding.local`;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY manquante.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function normalizeUsername(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function upsertAdminProfile(userId) {
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      username: ADMIN_USERNAME,
      display_name: ADMIN_DISPLAY_NAME,
      role: 'admin'
    });

  if (profileError) {
    throw profileError;
  }

  const { data: existingAlbum, error: albumLookupError } = await supabase
    .from('albums')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle();

  if (albumLookupError) {
    throw albumLookupError;
  }

  if (!existingAlbum) {
    const { error: albumInsertError } = await supabase
      .from('albums')
      .insert({
        owner_id: userId,
        title: `Album de ${ADMIN_DISPLAY_NAME}`
      });

    if (albumInsertError) {
      throw albumInsertError;
    }
  }
}

async function findExistingUser() {
  let page = 1;

  while (page < 20) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200
    });

    if (error) {
      throw error;
    }

    const foundUser = data.users.find(user => {
      const email = (user.email || '').toLowerCase();
      return email === ADMIN_EMAIL || email === LEGACY_ADMIN_EMAIL;
    });
    if (foundUser) {
      return foundUser;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }

  return null;
}

async function ensureAdmin() {
  const existingUser = await findExistingUser();

  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        username: ADMIN_USERNAME,
        display_name: ADMIN_DISPLAY_NAME
      },
      app_metadata: {
        ...(existingUser.app_metadata || {}),
        role: 'admin'
      }
    });

    if (error) {
      throw error;
    }

    await upsertAdminProfile(data.user.id);
    console.log(`Compte admin mis a jour: ${ADMIN_USERNAME}`);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      username: ADMIN_USERNAME,
      display_name: ADMIN_DISPLAY_NAME
    },
    app_metadata: {
      role: 'admin'
    }
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error('Utilisateur admin non cree.');
  }

  await upsertAdminProfile(data.user.id);
  console.log(`Compte admin cree: ${ADMIN_USERNAME}`);
}

ensureAdmin().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

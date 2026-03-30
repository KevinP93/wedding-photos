import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  'https://pipbutmzxzhcetlyxfxn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const LEGACY_DOMAIN = 'wedding.local';
const TARGET_DOMAIN = 'wedding-photos.example.com';

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

function getTargetEmail(user) {
  const metadataUsername = typeof user.user_metadata?.username === 'string'
    ? user.user_metadata.username
    : '';
  const emailLocalPart = String(user.email || '').split('@')[0] || '';
  const username = normalizeUsername(metadataUsername || emailLocalPart || user.id);
  return `${username}@${TARGET_DOMAIN}`;
}

async function listAllUsers() {
  const users = [];
  let page = 1;

  while (page < 20) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200
    });

    if (error) {
      throw error;
    }

    users.push(...data.users);

    if (data.users.length < 200) {
      break;
    }

    page += 1;
  }

  return users;
}

async function migrateLegacyUsers() {
  const users = await listAllUsers();
  const legacyUsers = users.filter(user => {
    const email = String(user.email || '').toLowerCase();
    return email.endsWith(`@${LEGACY_DOMAIN}`);
  });

  if (legacyUsers.length === 0) {
    console.log('Aucun compte legacy a migrer.');
    return;
  }

  for (const user of legacyUsers) {
    const targetEmail = getTargetEmail(user);
    const currentEmail = String(user.email || '').toLowerCase();

    if (currentEmail === targetEmail) {
      continue;
    }

    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      email: targetEmail,
      email_confirm: true,
      user_metadata: {
        ...(user.user_metadata || {}),
        username: normalizeUsername(
          String(user.user_metadata?.username || currentEmail.split('@')[0] || user.id)
        )
      }
    });

    if (error) {
      throw new Error(`${currentEmail} -> ${targetEmail}: ${error.message}`);
    }

    console.log(`${currentEmail} -> ${targetEmail}`);
  }

  console.log(`Migration terminee: ${legacyUsers.length} compte(s).`);
}

migrateLegacyUsers().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

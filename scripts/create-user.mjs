/**
 * Create a user in the PocketBase `users` collection.
 *
 * Credentials are never stored in this file - pass them on the command line
 * or through environment variables so they stay out of the repository.
 *
 * Usage:
 *   node scripts/create-user.mjs --username Admin --email admin@example.com \
 *     --password 'YourPassword' --name 'مدیر سامانه' --phone 09123456789
 *
 * If the `users` collection does not allow public sign-up, also set superuser
 * credentials so the script can authenticate first:
 *   PB_SUPERUSER_EMAIL=... PB_SUPERUSER_PASSWORD=... node scripts/create-user.mjs ...
 *
 * Note: the app grants the admin role to any user whose username is exactly
 * "admin" (case-insensitive), or whose `role` field is "admin"
 * - see src/services/pocketbase.ts.
 */

import PocketBase from 'pocketbase';

const POCKETBASE_URL = process.env.POCKETBASE_URL || 'https://parstask.pockethost.io';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

const USAGE = `Create a user in the PocketBase users collection.

  node scripts/create-user.mjs --username <name> --email <address> --password <secret>

Options:
  --username  Login name. "admin" grants the admin role automatically.
  --email     Email address for the account (required by PocketBase).
  --password  At least 8 characters.
  --name      Display name. Defaults to the username.
  --phone     Mobile number. Optional.
  --role      Set to "admin" to grant admin rights under any username.

Environment:
  POCKETBASE_URL         Backend URL. Defaults to ${POCKETBASE_URL}.
  PB_SUPERUSER_EMAIL     Superuser login, needed when public sign-up is closed.
  PB_SUPERUSER_PASSWORD  Superuser password.
`;

if (args.help || args.h) {
  console.log(USAGE);
  process.exit(0);
}

const username = args.username || process.env.NEW_USER_USERNAME;
const email = args.email || process.env.NEW_USER_EMAIL;
const password = args.password || process.env.NEW_USER_PASSWORD;
const name = args.name || process.env.NEW_USER_NAME || username;
const phone = args.phone || process.env.NEW_USER_PHONE || '';
const role = args.role || process.env.NEW_USER_ROLE || '';

const missing = [];
if (!username) missing.push('--username');
if (!email) missing.push('--email');
if (!password) missing.push('--password');

if (missing.length > 0) {
  console.error('Missing required argument(s): ' + missing.join(', '));
  console.error('Run with --help to see usage.');
  process.exit(1);
}

if (password.length < 8) {
  console.error('PocketBase requires a password of at least 8 characters.');
  process.exit(1);
}

const pb = new PocketBase(POCKETBASE_URL);

async function authenticateAsSuperuserIfConfigured() {
  const suEmail = process.env.PB_SUPERUSER_EMAIL;
  const suPassword = process.env.PB_SUPERUSER_PASSWORD;
  if (!suEmail || !suPassword) return false;

  // PocketBase v0.23+ exposes superusers as a collection; older builds use admins.
  try {
    await pb.collection('_superusers').authWithPassword(suEmail, suPassword);
    return true;
  } catch {
    await pb.admins.authWithPassword(suEmail, suPassword);
    return true;
  }
}

async function usernameTaken(value) {
  try {
    await pb.collection('users').getFirstListItem(`username = "${value}"`);
    return true;
  } catch (err) {
    if (err?.status === 404) return false;
    // A 403 here just means the list rule is closed; let the create call decide.
    return false;
  }
}

async function main() {
  console.log('PocketBase: ' + POCKETBASE_URL);

  const authed = await authenticateAsSuperuserIfConfigured();
  console.log('Superuser auth: ' + (authed ? 'yes' : 'no (using public sign-up)'));

  if (await usernameTaken(username)) {
    console.error(`A user with username "${username}" already exists. Nothing was created.`);
    process.exit(1);
  }

  const payload = {
    username,
    email: email.trim().toLowerCase(),
    password,
    passwordConfirm: password,
    name,
    theme: 'default',
    colorPalette: 'indigo',
    themeMode: 'light',
    notifySms: true,
  };
  if (phone) {
    payload.phoneNumber = phone;
    payload.phone = phone;
    payload.mobile = phone;
  }
  if (role) payload.role = role;

  let record;
  try {
    record = await pb.collection('users').create(payload);
  } catch (err) {
    // Custom schema fields may not exist on every deployment - retry with the
    // core fields PocketBase always accepts.
    console.warn('Full payload rejected, retrying with core fields only...');
    console.warn('Reason: ' + JSON.stringify(err?.response?.data || err?.data || err?.message));
    const core = {
      username,
      email: payload.email,
      password,
      passwordConfirm: password,
      name,
    };
    if (role) core.role = role;
    record = await pb.collection('users').create(core);
  }

  console.log('');
  console.log('User created.');
  console.log('  id:       ' + record.id);
  console.log('  username: ' + record.username);
  console.log('  email:    ' + record.email);

  const grantsAdmin = String(record.username || '').toLowerCase() === 'admin' || record.role === 'admin';
  console.log('  admin:    ' + (grantsAdmin ? 'yes' : 'NO - see note below'));

  if (!grantsAdmin) {
    console.log('');
    console.log('This account will NOT have admin rights. The app grants admin only when');
    console.log('the username is exactly "admin" or the record\'s role field is "admin".');
    console.log('Re-run with --role admin, or set the role field in the PocketBase panel.');
  }
}

main().catch((err) => {
  const detail = err?.response?.data || err?.data || err?.message || err;
  console.error('');
  console.error('Failed to create the user.');
  console.error(JSON.stringify(detail, null, 2));
  if (err?.status === 400) {
    console.error('');
    console.error('A 400 usually means the email or username is already taken,');
    console.error('or the password does not meet the collection rules.');
  }
  if (err?.status === 403) {
    console.error('');
    console.error('A 403 means the users collection does not allow public sign-up.');
    console.error('Set PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD and try again.');
  }
  process.exit(1);
});

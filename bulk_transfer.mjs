/**
 * Bulk Transfer — pure fetch, no Firebase SDK dependency issues.
 * Run: node bulk_transfer.mjs
 */

const API_KEY    = 'AIzaSyBLN0h3kD2QqWMU1OYQN-0CNbBgnG_CORg';
const PROJECT_ID = 'meme-millions-3f7b1';
const FS_BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_URL   = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;

const TRANSFERS = [
  { teamUsername: 'rahulsaki',        memeName: 'sharuk' },
  { teamUsername: 'nobrainers',       memeName: 'shinchan' },
  { teamUsername: 'bazooka',          memeName: 'absolute cinema' },
  { teamUsername: 'corroded coffeee', memeName: 'drake' },
  { teamUsername: 'alquaeda',         memeName: 'asalmaan khan' },
  { teamUsername: 'pdp231',           memeName: 'ajay begam' },
  { teamUsername: 'auratkachakkar',   memeName: 'amitabh' },
  { teamUsername: 'shreyasg',         memeName: 'doggy' },
  { teamUsername: 'vaish1407',        memeName: 'smarth think' },
  { teamUsername: 'pavan2507',        memeName: 'spiderman' },
  { teamUsername: 'sanjith',          memeName: 'varun dawan' },
  { teamUsername: 'potterhead',       memeName: 'brown doggy' },
  { teamUsername: 'Cassata',          memeName: 'modi ji' },
  { teamUsername: 'LOoters',          memeName: 'son' },
  { teamUsername: 'icecube',          memeName: '67' },
];
const SHARES = 10;

// ── Firestore REST helpers ────────────────────────────────────────────────────

function fsVal(v) {
  if (typeof v === 'number') return { integerValue: String(Math.round(v)) };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  return { nullValue: null };
}

function parseVal(v) {
  if (v == null) return null;
  if ('integerValue'  in v) return Number(v.integerValue);
  if ('doubleValue'   in v) return Number(v.doubleValue);
  if ('stringValue'   in v) return v.stringValue;
  if ('booleanValue'  in v) return v.booleanValue;
  return null;
}

function parseDoc(doc) {
  const out = { __id: doc.name.split('/').at(-1) };
  for (const [k, v] of Object.entries(doc.fields || {})) out[k] = parseVal(v);
  return out;
}

async function fsGet(path, idToken) {
  const r = await fetch(`${FS_BASE}/${path}`, {
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
  });
  if (!r.ok) throw new Error(`GET ${path}: ${r.status} ${await r.text()}`);
  return parseDoc(await r.json());
}

async function fsList(collection, idToken) {
  let docs = [], pageToken;
  do {
    const url = `${FS_BASE}/${collection}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const r = await fetch(url, { headers: idToken ? { Authorization: `Bearer ${idToken}` } : {} });
    if (!r.ok) throw new Error(`LIST ${collection}: ${r.status} ${await r.text()}`);
    const j = await r.json();
    if (j.documents) docs.push(...j.documents.map(parseDoc));
    pageToken = j.nextPageToken;
  } while (pageToken);
  return docs;
}

async function fsPatch(path, fields, idToken) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fsVal(v)])) };
  const updateMask = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
  const r = await fetch(`${FS_BASE}/${path}?${updateMask}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`PATCH ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function fsCreate(collection, fields, idToken) {
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fsVal(v)])) };
  const r = await fetch(`${FS_BASE}/${collection}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`CREATE ${collection}: ${r.status} ${await r.text()}`);
  return r.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Get anonymous ID token via Identity Toolkit
  console.log('🔐 Getting anonymous auth token…');
  const authRes = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  if (!authRes.ok) throw new Error(`Auth failed: ${authRes.status} ${await authRes.text()}`);
  const { idToken } = await authRes.json();
  console.log('✅ Authenticated\n');

  // 2. Load all users and memes
  console.log('📦 Loading users & memes…');
  const [users, memes] = await Promise.all([
    fsList('users',   idToken),
    fsList('memes',   idToken),
  ]);
  console.log(`   ${users.length} users, ${memes.length} memes loaded\n`);

  const findUser = (name) =>
    users.find(u => u.username?.toLowerCase() === name.toLowerCase());

  const findMeme = (name) => {
    const lc = name.toLowerCase().trim();
    return memes.find(m => m.name?.toLowerCase().trim() === lc)
        || memes.find(m => m.name?.toLowerCase().includes(lc))
        || memes.find(m => lc.includes(m.name?.toLowerCase().trim()));
  };

  let passed = 0, failed = 0;

  for (const { teamUsername, memeName } of TRANSFERS) {
    const toUser = findUser(teamUsername);
    const meme   = findMeme(memeName);

    if (!toUser) { console.error(`❌ SKIP — User not found: "${teamUsername}"\n`); failed++; continue; }
    if (!meme)   { console.error(`❌ SKIP — Meme not found: "${memeName}"\n`);     failed++; continue; }

    console.log(`⏳ Market → ${toUser.username || toUser.name}  |  ${meme.name} × ${SHARES}`);

    try {
      const avail = meme.availableShares ?? 0;
      if (avail < SHARES) throw new Error(`Only ${avail} shares in market!`);

      // Find existing portfolio entry for this team + meme
      const portfolios = await fsList('portfolios', idToken);
      const existing = portfolios.find(p => p.userId === toUser.__id && p.memeId === meme.__id);

      // Deduct from market
      await fsPatch(`memes/${meme.__id}`, { availableShares: avail - SHARES }, idToken);
      // Update meme locally for subsequent iterations
      meme.availableShares = avail - SHARES;

      // Credit team portfolio
      if (existing) {
        await fsPatch(`portfolios/${existing.__id}`, { shares: existing.shares + SHARES }, idToken);
      } else {
        await fsCreate('portfolios', {
          userId: toUser.__id,
          memeId: meme.__id,
          shares: SHARES,
          averagePrice: meme.currentPrice ?? meme.initialPrice ?? 0,
        }, idToken);
      }

      console.log(`   ✅ Done — ${meme.name} × ${SHARES} → ${toUser.username || toUser.name}\n`);
      passed++;
    } catch (err) {
      console.error(`   ❌ FAILED: ${err.message}\n`);
      failed++;
    }
  }

  console.log('─'.repeat(55));
  console.log(`🎉 Complete: ${passed} succeeded, ${failed} failed`);
}

main().catch(err => { console.error('💥 Fatal:', err.message); process.exit(1); });

/**
 * Bulk Transfer Script — Meme Your Way to Millions
 * Run from project root: node bulk_transfer.mjs
 */
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, doc, getDocs, query, where, runTransaction
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBLN0h3kD2QqWMU1OYQN-0CNbBgnG_CORg",
  authDomain: "meme-millions-3f7b1.firebaseapp.com",
  projectId: "meme-millions-3f7b1",
  storageBucket: "meme-millions-3f7b1.firebasestorage.app",
  messagingSenderId: "300366052753",
  appId: "1:300366052753:web:55e2a9ecd6712615a16e30",
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);

// ── 15 Transfers: Market → Team, 10 shares each, price unchanged ─────────────
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

async function main() {
  console.log('🔐 Signing in anonymously…');
  await signInAnonymously(auth);
  console.log('✅ Authenticated\n');

  const [usersSnap, memesSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'memes')),
  ]);

  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const memes = memesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`📦 Loaded ${users.length} users, ${memes.length} memes\n`);

  const findUser = (u) =>
    users.find(x => x.username?.toLowerCase() === u.toLowerCase());

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
    if (!meme)   { console.error(`❌ SKIP — Meme not found: "${memeName}"\n`);   failed++; continue; }

    console.log(`⏳ Market → ${toUser.username || toUser.name}  |  ${meme.name} × ${SHARES}`);

    try {
      const toPortSnap = await getDocs(
        query(collection(db, 'portfolios'),
          where('userId', '==', toUser.id),
          where('memeId', '==', meme.id))
      );
      const existing  = toPortSnap.empty ? null : toPortSnap.docs[0];
      const toPortRef = existing ? doc(db, 'portfolios', existing.id) : null;
      const memeRef   = doc(db, 'memes', meme.id);

      await runTransaction(db, async (tx) => {
        const memeData = await tx.get(memeRef);
        const avail = memeData.data()?.availableShares ?? 0;
        if (avail < SHARES) throw new Error(`Only ${avail} shares available in market.`);

        // Deduct from market
        tx.update(memeRef, { availableShares: avail - SHARES });

        // Credit team portfolio
        if (toPortRef) {
          const cur = await tx.get(toPortRef);
          tx.update(toPortRef, { shares: (cur.data()?.shares ?? 0) + SHARES });
        } else {
          tx.set(doc(collection(db, 'portfolios')), {
            userId: toUser.id,
            memeId: meme.id,
            shares: SHARES,
            averagePrice: meme.currentPrice ?? meme.initialPrice ?? 0,
          });
        }
        // No budget change — free admin transfer
      });

      console.log(`   ✅ ${meme.name} × ${SHARES} → ${toUser.username || toUser.name}\n`);
      passed++;
    } catch (err) {
      console.error(`   ❌ FAILED: ${err.message}\n`);
      failed++;
    }
  }

  console.log('─'.repeat(55));
  console.log(`🎉 Done: ${passed} succeeded, ${failed} failed`);
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });

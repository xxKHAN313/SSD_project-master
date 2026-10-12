/**
 * dump_db.ts
 *
 * Read-only dump of every collection in the Shield-Chat database, with
 * the AES-256-GCM encrypted fields (User.email, Message.content)
 * decrypted using the same ENCRYPTION_KEY the app uses at runtime.
 *
 * Usage:
 *   cd backend
 *   npx ts-node ../tools/dump_db.ts
 *
 * No data is modified. The script connects, reads, prints, and exits.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import path from 'path';
import dotenv from 'dotenv';

// load backend/.env regardless of where this script is run from
dotenv.config({ path: path.resolve(__dirname, '..', 'backend', '.env') });

import { decrypt } from '../backend/src/utils/encryption';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is missing — make sure backend/.env exists');
  process.exit(1);
}

function tryDecrypt(value: unknown): string {
  if (typeof value !== 'string') return String(value);
  try {
    return decrypt(value);
  } catch {
    return value; // not encrypted, or wrong key
  }
}

async function main(): Promise<void> {
  await mongoose.connect(MONGODB_URI!);
  console.log(`\nConnected to ${mongoose.connection.name}\n`);

  const collections = await mongoose.connection.db!.listCollections().toArray();
  console.log(`Collections: ${collections.map((c) => c.name).join(', ')}\n`);

  for (const { name } of collections) {
    const coll = mongoose.connection.db!.collection(name);
    const count = await coll.countDocuments();
    console.log(`\n=== ${name} (${count} docs) ===`);

    const docs = await coll.find({}).limit(50).toArray();
    for (const doc of docs) {
      // decrypt the known-encrypted fields so they're readable
      const view: Record<string, unknown> = { ...doc };
      if (name === 'users' && typeof doc.email === 'string') {
        view.email = tryDecrypt(doc.email);
      }
      if (name === 'messages' && typeof doc.content === 'string') {
        view.content = tryDecrypt(doc.content);
      }
      // hide huge fields that aren't useful in a console dump
      if ('passwordHash' in view) view.passwordHash = '<bcrypt hash hidden>';
      if ('passwordHistory' in view) {
        view.passwordHistory = `<${(doc.passwordHistory as unknown[])?.length ?? 0} hashes>`;
      }
      if ('refreshTokenHash' in view) view.refreshTokenHash = '<sha256 hidden>';

      console.log(JSON.stringify(view, null, 2));
    }
    if (count > 50) console.log(`... (${count - 50} more docs not shown)`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('dump failed:', err);
  process.exit(1);
});

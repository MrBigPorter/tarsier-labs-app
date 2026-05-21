/**
 * Upload Android AAB to Google Play Internal Testing track.
 *
 * Uses the Google Play Developer API v3 directly via REST calls.
 * Replaces r0adkll/upload-google-play action which has a persistent
 * JSON parsing bug.
 *
 * Usage:
 *   node scripts/upload-android-play-store.mjs \
 *     --service-account-json /tmp/android-play-sa.json \
 *     --package-name com.tarsier.labs \
 *     --aab-path android/app/build/outputs/bundle/productionRelease/app-production-release.aab \
 *     --track internal
 *
 * Environment:
 *   GOOGLE_APPLICATION_CREDENTIALS - path to service account JSON (alternative to --service-account-json)
 */

import { readFileSync, createReadStream } from 'fs';
import { existsSync, statSync } from 'fs';
import https from 'https';
import http from 'http';

// ─── Parse CLI args ───────────────────────────────────────────────────────────

const args = {};
const rawArgs = process.argv.slice(2);
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i].startsWith('--')) {
    const key = rawArgs[i].replace(/^--/, '');
    args[key] = rawArgs[i + 1]?.startsWith('--') ? true : (rawArgs[i + 1] ?? true);
    if (rawArgs[i + 1] && !rawArgs[i + 1].startsWith('--')) i++;
  }
}

const SERVICE_ACCOUNT_PATH =
  args['service-account-json'] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
const PACKAGE_NAME = args['package-name'];
const AAB_PATH = args['aab-path'];
const TRACK = args['track'] || 'internal';
const STATUS = args['status'] || 'completed';

// ─── Validate params ──────────────────────────────────────────────────────────

if (!SERVICE_ACCOUNT_PATH) {
  console.error('❌ Missing service account JSON path. Use --service-account-json or GOOGLE_APPLICATION_CREDENTIALS');
  process.exit(1);
}
if (!PACKAGE_NAME) {
  console.error('❌ Missing --package-name');
  process.exit(1);
}
if (!AAB_PATH || !existsSync(AAB_PATH)) {
  console.error(`❌ AAB not found at: ${AAB_PATH || '(not specified)'}`);
  process.exit(1);
}

console.log(`📦 Package: ${PACKAGE_NAME}`);
console.log(`📁 AAB: ${AAB_PATH} (${(statSync(AAB_PATH).size / 1024 / 1024).toFixed(1)} MB)`);
console.log(`🎯 Track: ${TRACK}`);
console.log(`📋 Status: ${STATUS}`);

// ─── Google Auth: get access token ────────────────────────────────────────────

async function getAccessToken(saPath) {
  const saRaw = readFileSync(saPath, 'utf-8');
  const sa = JSON.parse(saRaw);

  console.log(`🔑 Authenticating as: ${sa.client_email}`);

  // Create JWT claim
  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = { alg: 'RS256', typ: 'JWT' };
  const jwtPayload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  // Encode JWT parts
  const b64 = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const headerB64 = b64(jwtHeader);
  const payloadB64 = b64(jwtPayload);
  const signatureInput = `${headerB64}.${payloadB64}`;

  // Sign with RSA private key
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  sign.end();
  const signature = sign.sign(sa.private_key, 'base64');
  const jwt = `${signatureInput}.${signature}`;

  // Exchange JWT for access token
  const tokenResponse = await httpsPost('https://oauth2.googleapis.com/token', {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });

  const tokenData = JSON.parse(tokenResponse);
  console.log(`✅ Access token obtained (expires in ${tokenData.expires_in}s)`);
  return tokenData.access_token;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function httpsPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(body);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(
            new Error(
              `HTTP ${res.statusCode}: ${res.statusMessage}\nBody: ${data.slice(0, 2000)}`
            )
          );
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function httpsPostFile(url, filePath, mimeType, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const fileSize = statSync(filePath).size;
    const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`;

    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Length': fileSize,
        'Content-Type': mimeType || 'application/octet-stream',
        ...headers,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(
            new Error(
              `HTTP ${res.statusCode}: ${res.statusMessage}\nBody: ${data.slice(0, 2000)}`
            )
          );
        }
      });
    });
    req.on('error', reject);

    // Stream the file directly
    const fileStream = createReadStream(filePath);
    fileStream.pipe(req, { end: true });
    fileStream.on('error', (err) => {
      req.destroy(err);
      reject(err);
    });
  });
}

function httpsPut(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const putData = JSON.stringify(body);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(putData),
        ...headers,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(
            new Error(
              `HTTP ${res.statusCode}: ${res.statusMessage}\nBody: ${data.slice(0, 2000)}`
            )
          );
        }
      });
    });
    req.on('error', reject);
    req.write(putData);
    req.end();
  });
}

// ─── Main upload logic ────────────────────────────────────────────────────────

async function uploadToPlayStore() {
  try {
    // Step 1: Get access token
    const token = await getAccessToken(SERVICE_ACCOUNT_PATH);
    const authHeader = { Authorization: `Bearer ${token}` };

    // Step 2: Create a new Edit
    console.log('📝 Creating a new Edit...');
    const editResult = await httpsPost(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/edits`,
      {},
      authHeader
    );
    const editData = JSON.parse(editResult);
    const editId = editData.id;
    console.log(`✅ Edit created: ${editId} (expires at ${editData.expiryTimeSeconds})`);

    // Step 3: Upload AAB
    console.log('⬆️ Uploading AAB...');
    const uploadUrl = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE_NAME}/edits/${editId}/bundles`;
    const bundleResult = await httpsPostFile(
      uploadUrl,
      AAB_PATH,
      'application/octet-stream',
      authHeader
    );
    const bundleData = JSON.parse(bundleResult);
    const versionCode = bundleData.versionCode;
    console.log(`✅ AAB uploaded! Version code: ${versionCode}`);

    // Step 4: Assign to track
    console.log(`🎯 Assigning to track: ${TRACK}...`);
    const trackUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/edits/${editId}/tracks/${TRACK}`;
    const trackBody = {
      track: TRACK,
      releases: [
        {
          name: `CI Build #${versionCode}`,
          versionCodes: [String(versionCode)],
          status: STATUS,
        },
      ],
    };
    const trackResult = await httpsPut(trackUrl, trackBody, authHeader);
    console.log(`✅ Track updated: ${TRACK}`);

    // Step 5: Commit the edit
    console.log('💾 Committing edit...');
    const commitUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/edits/${editId}:commit`;
    const commitResult = await httpsPost(commitUrl, {}, authHeader);
    const commitData = JSON.parse(commitResult);
    console.log(`✅ Edit committed successfully! ID: ${commitData.id}`);

    // Step 6: Output results
    console.log('\n═══════════════════════════════════════════');
    console.log('✅ GOOGLE PLAY UPLOAD COMPLETE');
    console.log(`   Edit ID: ${commitData.id}`);
    console.log(`   Version Code: ${versionCode}`);
    console.log(`   Track: ${TRACK}`);
    console.log(`   Status: ${STATUS}`);
    console.log('═══════════════════════════════════════════\n');

    // Set GitHub Actions outputs
    if (process.env.GITHUB_OUTPUT) {
      const fs = await import('fs');
      const outputLines = [
        `edit_id=${commitData.id}`,
        `version_code=${versionCode}`,
        `track=${TRACK}`,
      ];
      fs.appendFileSync(process.env.GITHUB_OUTPUT, '\n' + outputLines.join('\n') + '\n');
    }

    return { editId: commitData.id, versionCode };
  } catch (err) {
    console.error(`\n❌ Upload failed: ${err.message}`);
    if (err.response) {
      try {
        const detail = JSON.parse(err.response);
        console.error(`   API Error: ${JSON.stringify(detail.error || detail, null, 2)}`);
      } catch {
        console.error(`   Raw response: ${err.response?.slice(0, 500)}`);
      }
    }
    process.exit(1);
  }
}

uploadToPlayStore();

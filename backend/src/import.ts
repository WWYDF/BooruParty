// This is an independant importer script designed to help you transition from v0.14.2 to v2.0.0.
// This only runs if you specifically call it to run with `bun importdata`.

// Please backup your postgres database and backend data folder.
// This script is only intended to be run once, it will bail if v2 is already setup.

// Sorry if this file is a bit messy, I want to keep everything in one file the best I can.

import { confirm, input, number, password, select } from "@inquirer/prompts";
import chalk from "chalk";
import { SQL } from "bun";
import { Prisma, PrismaClient } from "../prisma/client";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const old_ver = 'v0.14.2';

const c = { debug: chalk.gray, info: chalk.cyan, success: chalk.green, warn: chalk.yellow, error: chalk.red.bold, critical: chalk.bgRed.whiteBright };
export const log = (level: keyof typeof c, ...args: unknown[]) => console.log(c[level](`[${level.toUpperCase()}]`), ...args);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                       Inquiries
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// First we need to get a bunch of data from the user through inquirer
// This is not kept between attempts, so I recommend opening notepad lol
type Database = {
  name: string,
  host: string,
  port: number,
  username: string,
  password: string,
}

async function getOldDb(): Promise<Database> {
  console.clear();
  const pfx = "OLD"; // in case I change it later
  const name = await input({
    message: `${pfx} Database Name:`,
    default: 'database',
    required: true,
    validate: (v) => v.trim().length > 0 || 'Required',
  });

  const host = await input({
    message: `${pfx} Database Host:`,
    default: 'localhost',
    required: true,
    validate: (v) => v.trim().length > 0 || 'Required',
  });

  const port = await number({
    message: `${pfx} Database Port:`,
    default: 5432,
    required: true,
  });

  const username = await input({
    message: `${pfx} Postgres Username:`,
    default: 'username',
    required: true,
    validate: (v) => v.trim().length > 0 || 'Required',
  });

  const pwd = await password({
    message: `${pfx} Postgres Password:`,
    mask: '*',
  });

  return { name, host, port, username, password: pwd };
}

async function getNewDb(): Promise<Database> {
  console.clear();
  log('warn', "Please make sure the new database already exists in psql.");
  const pfx = 'NEW'; // in case I change it later
  const name = await input({
    message: `${pfx} Database Name:`,
    default: 'boorupartyv2',
    required: true,
    validate: (v) => v.trim().length > 0 || 'Required',
  });

  const host = await input({
    message: `${pfx} Database Host:`,
    default: 'localhost',
    required: true,
    validate: (v) => v.trim().length > 0 || 'Required',
  });

  const port = await number({
    message: `${pfx} Database Port:`,
    default: 5432,
    required: true,
  });

  const username = await input({
    message: `${pfx} Postgres Username:`,
    default: 'bpUser',
    required: true,
    validate: (v) => v.trim().length > 0 || 'Required',
  });

  const pwd = await password({
    message: `${pfx} Postgres Password:`,
    mask: '*',
  });

  return { name, host, port, username, password: pwd };
}


// Get Site Settings
type SiteSettings = {
  frontendDomain: string,
  backendDomain: string,
  guestViewing?: boolean, // change guest safety in dashboard later
  // add mailgun/smtp here later
}

async function getSiteSettings(): Promise<SiteSettings> {
  console.clear();
  log('warn', "Please no trailing slashes on URLs. (a good URL looks like https://example.booru.party");
  const frontendDomain = await input({
    message: `Frontend Site URL:`,
    required: true,
    validate: (v) => { try { return ['http:', 'https:'].includes(new URL(v).protocol) || 'Must be http(s)'; } catch { return 'Invalid URL'; } },
  });

  const backendDomain = await input({
    message: `Backend Site URL:`,
    required: true,
    validate: (v) => { try { return ['http:', 'https:'].includes(new URL(v).protocol) || 'Must be http(s)'; } catch { return 'Invalid URL'; } },
  });

  const guestViewing = await confirm({
    message: `Are guests allowed to browse?`,
    default: true,
  });

  return { frontendDomain, backendDomain, guestViewing };
}


// Get old backend options
type BackendOptions = {
  videoEncoderOverride: string | null,
  videoCodec: SelectCodec | null,
  disableVideoPreviews: boolean,
  disableAnimationPreviews: boolean,
  convertShortMuteVids: boolean,
  port: number,
}
type SelectEncoder = 'automatic' | 'nvenc' | 'qsv' | 'amf' | 'cpu';
type SelectCodec = 'vp9' | 'h264' | 'h265' | 'av1';

async function getBackendOpts(): Promise<BackendOptions> {
  console.clear();
  log('info', "Video Encoders are not validated here, instead at runtime.");
  log('info', "If you want (or need) to switch later, edit the values in .env");
  console.log('');

  const videoPreviews = await confirm({
    message: 'Should we generate previews for videos?',
    default: true,
  });

  let selectedCodec: string | null = null;
  let selectedEncoder: string | null = null;

  if (videoPreviews) {
    selectedEncoder = await select({
      message: `What device should encode video previews?`,
      choices: [
        { value: 'automatic', name: 'Pick the best for me on startup' },
        { value: 'nvenc', name: 'NVENC (Hardware, NVIDIA)' },
        { value: 'qsv', name: 'QuickSync (Hardware, Intel)' },
        { value: 'amf', name: 'AMF (Hardware, AMD)' },
        { value: 'cpu', name: 'None (Software, CPU)' },
      ],
    });

    selectedCodec = await select({
      message: `What should video previews be encoded with?`,
      choices: [ // sorted by recommendation
        {
          value: 'vp9',
          name: `VP9${selectedEncoder == 'qsv' ? ' (Recommended)' : ''}`, // VP9 is great on intel gpus, not so great on software encoding lol
          disabled: (selectedEncoder !== 'qsv' && selectedEncoder !== 'cpu' && selectedEncoder !== 'automatic') && '(Not compatible with selected device)'
        },
        {
          value: 'h265',
          name: 'H.265 (HEVC)',
        },
        {
          value: 'h264',
          name: 'H.264 (AVC)'
        },
        {
          value: 'av1',
          name: 'AV1',
          disabled: (selectedEncoder == 'amf') && '(Not compatible with selected device)'
        },
      ],
    });
  };

  const animPreviews = await confirm({
    message: 'Should we generate previews for GIFs?',
    default: true,
  });

  const convertShortMuteVids = await confirm({
    message: 'Should we automatically convert short, muted videos into GIFs?',
    default: true,
  });

  const selectedPort = await number({
    message: 'What port should the backend run on?',
    default: 3070,
  });

  return {
    videoCodec: selectedCodec as SelectCodec,
    videoEncoderOverride: selectedEncoder !== null ? getEncodeDeviceFromSelection(selectedEncoder as SelectEncoder, selectedCodec as SelectCodec) : null,
    disableVideoPreviews: !videoPreviews,
    disableAnimationPreviews: !animPreviews,
    convertShortMuteVids,
    port: selectedPort ?? 3070,
  };
}

// User can't select impossible combinations, so assume it works
function getEncodeDeviceFromSelection(encoder: SelectEncoder, codec: SelectCodec): string | null {
  if (codec == 'vp9') {
    switch (encoder) {
      case 'automatic': return null;
      case 'qsv': return 'vp9_qsv';
    };
  } else if (codec === 'h265') {
    switch (encoder) {
      case 'automatic': return null;
      case 'qsv': return 'hevc_qsv';
      case 'nvenc': return 'hevc_nvenc';
      case 'amf': return 'hevc_amf';
      case 'cpu': return 'libx265';
    }
  } else if (codec === 'h264') {
    switch (encoder) {
      case 'automatic': return null;
      case 'qsv': return 'h264_qsv';
      case 'nvenc': return 'h264_nvenc';
      case 'amf': return 'h264_amf';
      case 'cpu': return 'libx264';
    }
  } else if (codec === 'av1') {
    switch (encoder) {
      case 'automatic': return null;
      case 'qsv': return 'av1_qsv';
      case 'nvenc': return 'av1_nvenc';
      case 'cpu': return 'libsvtav1';
    }
  }
  return null; // if we somehow get back down here, just default to automatic
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                    Environment
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// false = dont inquire (except old db) | true = inquire all values
async function checkShouldInquire(): Promise<boolean> {
  const envPath = path.resolve(process.cwd(), '.env');

  if (fs.existsSync(envPath)) { // check if .env exists on disk
    dotenv.config({ path: envPath });
    if ( // check if .env has valid values
      process.env.DATABASE_URL?.startsWith("postgresql://") &&
      process.env.FRONTEND_URL?.startsWith("http") &&
      process.env.BACKEND_URL?.startsWith("http") &&
      process.env.JWT_SECRET
    ) { // it does, skip inquiries
      log('info', ".env already exists with valid values, skipping inquiries.");
      return false;
    } else { // it doesn't, ask if they want to continue (overwrite)
      const msgPfx = ".env already exists, but the values are not valid."
      log('warn', `${msgPfx} Continuing will overwrite the entire file.`);
      const cont = await confirm({ message: "Continue?", default: false, });
      if (cont) { return true } // they do
      else { log('error', msgPfx); process.exit(0); } // they don't (stop script)
    }
  } else { // .env doesn't exist yet, create it and inquire new values
    fs.writeFileSync(envPath, '');
    return true;
  }
}

async function parseEnv(): Promise<{ NEW_DATABASE: Database, SETTINGS: SiteSettings, OPTIONS: BackendOptions }> {
  const envPath = path.resolve(process.cwd(), '.env');
  dotenv.config({ path: envPath });

  // We assume all required values exist, if they don't, the script crashes anyway.
  const dbUrl = new URL(process.env.DATABASE_URL!);
  const NEW_DATABASE: Database = {
    name: dbUrl.pathname.slice(1),
    username: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    host: dbUrl.hostname,
    port: Number(dbUrl.port) || 5432,
  };

  const SETTINGS: SiteSettings = {
    frontendDomain: process.env.FRONTEND_URL!,
    backendDomain: process.env.BACKEND_URL!,
    // guestViewing isn't set by .env, so just ignore it
  }

  const OPTIONS: BackendOptions = {
    videoEncoderOverride: process.env.ENCODER_OVERRIDE!.trim(),
    videoCodec: process.env.VIDEO_CODEC ? process.env.VIDEO_CODEC! as SelectCodec : null,
    disableVideoPreviews: Boolean(process.env.DISABLE_VIDEO_PREVIEWS!),
    disableAnimationPreviews: Boolean(process.env.DISABLE_ANIMATION_PREVIEWS!),
    convertShortMuteVids: Boolean(process.env.FORCE_CONVERT_SHORT_VIDEOS!),
    port: Number(process.env.API_PORT ?? 3070),
  }

  return { NEW_DATABASE, SETTINGS, OPTIONS }
}

async function saveToEnv(db: Database, settings: SiteSettings, opts: BackendOptions) {
  log('debug', "Saving inquiries to .env...");
  const envPath = path.resolve(process.cwd(), '.env');
  fs.appendFileSync(envPath, `DATABASE_URL="postgresql://${db.username}:${db.password}@${db.host}:${db.port}/${db.name}"\n`);
  fs.appendFileSync(envPath, `LOG_LEVEL=INFO\n`);
  fs.appendFileSync(envPath, `API_PORT=${opts.port}\n`);
  fs.appendFileSync(envPath, `FRONTEND_URL="${settings.frontendDomain}"\n`);
  fs.appendFileSync(envPath, `BACKEND_URL="${settings.backendDomain}"\n`);
  fs.appendFileSync(envPath, `JWT_SECRET=${crypto.randomBytes(64).toString('hex')}\n`);
  fs.appendFileSync(envPath, `VIDEO_CODEC=${opts.videoCodec}\n`);
  if (opts.videoEncoderOverride) { fs.appendFileSync(envPath, `ENCODER_OVERRIDE=${opts.videoEncoderOverride}\n`); }
  else { fs.appendFileSync(envPath, `# ENCODER_OVERRIDE=\n`); }
  fs.appendFileSync(envPath, `DISABLE_VIDEO_PREVIEWS=${opts.disableVideoPreviews}\n`);
  fs.appendFileSync(envPath, `DISABLE_ANIMATION_PREVIEWS=${opts.disableAnimationPreviews}\n`);
  fs.appendFileSync(envPath, `MODE=PRODUCTION\n`);
  log('success', "Saved to .env successfully.");
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                       Main
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function main() {
  console.clear();
  log('info', "This is an independent importer script designed to help you transition from v0.14.2 to v2.0.0.");
  log('info', "Please backup your postgres database and backend data folder.");
  console.log('');

  let oldDb: SQL | undefined;
  let prisma: PrismaClient | undefined;

  try {
    // Check .env for existing values
    const shouldInquire = await checkShouldInquire();

    let NEW_DATABASE: Database;
    let SETTINGS: SiteSettings;
    let OPTIONS: BackendOptions;
    if (shouldInquire) {
      NEW_DATABASE = await getNewDb();
      SETTINGS = await getSiteSettings();
      OPTIONS = await getBackendOpts();
    } else {
      // Parse .env to fill required objects
      const parsed = await parseEnv();
      NEW_DATABASE = parsed.NEW_DATABASE;
      SETTINGS = parsed.SETTINGS;
      OPTIONS = parsed.OPTIONS;
    }

    // always ask for old db info, we don't save it lol
    const OLD_DATABASE = await getOldDb();
    
    console.clear();

    // Validate database connections
    log('info', 'Validating database connections...');
    const newDbUrl = `postgresql://${NEW_DATABASE.username}:${encodeURIComponent(NEW_DATABASE.password)}@${NEW_DATABASE.host}:${NEW_DATABASE.port}/${NEW_DATABASE.name}`;
    try {
      prisma = new PrismaClient({ datasourceUrl: newDbUrl });
      oldDb = new SQL({ hostname: 'localhost', port: OLD_DATABASE.port, database: OLD_DATABASE.name, username: OLD_DATABASE.username, password: OLD_DATABASE.password });
    
      const [oldSettings] = await oldDb`SELECT * FROM "SiteSettings" WHERE id = 1`;
      if (!oldSettings || !oldSettings.setupComplete) { throw new Error(`${old_ver} database is empty or not set up yet!`) };
      const isDbOccupied = await prisma.serverSettings.findFirst({ where: { id: 1 } }).catch((e) => {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2021') return null;
        throw e;
      });
      if (isDbOccupied && isDbOccupied.lastSetupVersion) { throw new Error("New database isn't empty! Please clear it first.") };
    } catch (e) {
      if (e instanceof Error) { log('critical', e.message); process.exit(0); }
      throw e;
    }

    // Database valid, save inquiries to .env now
    log('success', 'Databases are valid.');
    if (shouldInquire) { await saveToEnv(NEW_DATABASE, SETTINGS, OPTIONS) };
    
    try {
      // Run prisma regen in child process
      Bun.spawnSync(['bunx', 'prisma', 'db', 'push', '--skip-generate'], { env: { ...process.env, DATABASE_URL: newDbUrl }, stdout: 'ignore', stderr: 'inherit' });
    } catch (e) {
      log('error', `Failed to regerate new database! Please run 'bun regen' yourself, then restart the script.`);
      process.exit(0);
    }

    // after all inquirer fields are asked and dbs are validated that they can connect
    console.log('');
    log('warn', "The section after this is only intended to be run once, so please confirm you are ready.");
    const ready = await confirm({ message: 'Continue?', default: false });
    if (!ready) { log('info', "Cancelled."); process.exit(0); };

    // BEGIN: Call import handlers
    log('info', "Starting posts handler...");
    await postsHandler(oldDb, prisma);


  } catch (error) {
    if (error instanceof Error && error.name == 'ExitPromptError') { log('info', "Cancelled."); return; };
    log('critical', error);
    return;
  } finally {
    // Close database connections no matter what
    await oldDb?.close();
    await prisma?.$disconnect();
  }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                       Posts
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
type OldPost = {
  id: number,
  fileExt: string,
  type: string | null,
  originalPath: string | null,
  previewPath: string | null,
  aspectRatio: number,
  safety: 'SAFE' | 'SKETCHY' | 'UNSAFE',
  // tags
  // pools
  // relatedTo
  // relatedFrom
  sources: string[],
  notes: string | null,
  previewScale: number | null,
  pHash: string | null,
  dupeBypass: boolean,
  score: number,
  // boosts (imported separately later)
  // votes (imported separately later)
  // comments (imported separately later)
  // favoritedBy (imported separately later)
  // collections (imported separately later)
  uploadedById: string,
  fileSize: number | null,
  previewSize: number | null,
  duration: number | null,
  hasAudio: boolean | null,
  createdAt: Date,
}

// Main Posts handler (oldDb is OLD, prisma is NEW)
async function postsHandler(oldDb: SQL, prisma: PrismaClient) {
  const dataDir = path.join(process.cwd(), 'data');
  const oldDataDir = path.join(process.cwd(), 'data.old');
  if (!fs.existsSync(dataDir)) { throw new Error("Data Directory doesn't exist! Are you sure you need to import anything?") };

  // rename legacy data directory to make way for new one
  fs.renameSync(dataDir, oldDataDir);
  fs.mkdirSync(dataDir); // make new data folder

  // Start processing individually through batches
  let lastId = 0;
  const BATCH = 500;
  const failedIds = [];

  while (true) {
    const posts = await oldDb`
      SELECT * FROM "Post"
      WHERE id > ${lastId}
      ORDER BY id
      LIMIT ${BATCH}
    ` as OldPost[];
    if (posts.length === 0) break; // nothing left

    for (const post of posts) {
      const success = await importPost(oldDb, prisma, post);
      if (!success) failedIds.push(post.id);
    }
  }
}

// Posts handler components
async function importPost(oldDb: SQL, prisma: PrismaClient, post: OldPost): Promise<boolean> {
  return true;
}




main(); // run script
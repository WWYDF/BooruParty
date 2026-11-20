// This is an independant importer script designed to help you transition from v0.14.2 to v2.0.0.
// This only runs if you specifically call it to run with `bun importdata`.

// Please backup your postgres database and backend data folder.
// This script is only intended to be run once, it will bail if v2 is already setup.

// Sorry if this file is a bit messy, I want to keep everything in one file the best I can.

import { confirm, input, number, password, select } from "@inquirer/prompts";
import chalk from "chalk";
import { SQL } from "bun";
import { FileType, Prisma, PrismaClient, Role, Safety } from "../prisma/client";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { normalizeTagName, resolveTagNames } from "./core/utilities/tags";
import { detectFileType } from "./components/uploads/receive";
import { THUMBNAIL_SIZES } from "./components/uploads/thumbnails";
import { parseArgs } from "util";
import sharp from "sharp";

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
  jwtSecret: string | null,
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

  log('info', "OLD 'frontend/.env' JWT Secret is required for user sign-ins to continue working normally.");
  log ('warn', "If this is skipped, all users will be created, but they have to change their passwords.");
  const jwtSecret = await input({
    message: `OLD JWT Secret:`,
    required: false,
  });

  return { frontendDomain, backendDomain, guestViewing, jwtSecret };
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
    jwtSecret: process.env.JWT_SECRET!,
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
  if (settings.jwtSecret) { fs.appendFileSync(envPath, `JWT_SECRET=${settings.jwtSecret}\n`); }
  else {fs.appendFileSync(envPath, `JWT_SECRET=${crypto.randomBytes(64).toString('hex')}\n`);  }
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

    let OLD_DATABASE: Database;
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
    const { values, positionals } = parseArgs({
      args: Bun.argv.slice(2),
      options: {
        database: { type: 'string', short: 'd' },
        host: { type: 'string', short: 'h' },
        port: { type: 'string', short: 'p' },
        username: { type: 'string', short: 'u' },
        password: { type: 'string', short: 'P' },
        force: { type: 'boolean', short: 'y' },
      },
      allowPositionals: true,
    });
    if (!values.database) { OLD_DATABASE = await getOldDb(); }
    else { OLD_DATABASE = { host: values.host ?? 'localhost', port: Number(values.port ?? 5432), username: values.username!, password: values.password!, name: values.database! } };
    
    console.clear();

    // Validate database connections
    log('info', 'Validating database connections...');
    const newDbUrl = `postgresql://${NEW_DATABASE.username}:${encodeURIComponent(NEW_DATABASE.password)}@${NEW_DATABASE.host}:${NEW_DATABASE.port}/${NEW_DATABASE.name}`;
    try {
      prisma = new PrismaClient({ datasourceUrl: newDbUrl });
      oldDb = new SQL({ hostname: OLD_DATABASE.host, port: OLD_DATABASE.port, database: OLD_DATABASE.name, username: OLD_DATABASE.username, password: OLD_DATABASE.password });
    
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
    let ready = false;
    if (values && values.force) { ready = true }
    else { ready = await confirm({ message: 'Continue?', default: false }); }
    if (!ready) { log('info', "Cancelled."); process.exit(0); };

    // BEGIN: Call import handlers

    // USERS
    log('info', "Starting Role handler...");
    await rolesHandler(oldDb, prisma);

    log('info', "Starting Users handler...");
    await usersHandler(oldDb, prisma);

    log('info', "Starting User Preferences handler...");
    await userPrefsHandler(oldDb, prisma); // not actually setup yet lol

    // TAGS
    log('info', "Starting Tag Categories handler...");
    await tagCatHandler(oldDb, prisma);

    log('info', "Starting Tags handler...");
    await tagHandler(oldDb, prisma);

    log('info', "Starting Tag Alias handler...");
    await tagAliasHandler(oldDb, prisma);

    log('info', "Starting Tag Implications & Suggestions handler...");
    await tagImpSuggHandler(oldDb, prisma);
    
    // POSTS
    // Handle posts as late as possible since its the slowest (and requires tags to be processed already)
    log('info', "Starting Posts handler...");
    await postsHandler(oldDb, prisma);

    log('info', "Starting Related Posts handler...");
    await relatedPostsHandler(oldDb, prisma);

    // POOLS
    log('info', "Starting Pools handler...");
    await poolsHandler(oldDb, prisma);

    log('info', "Starting Pool Favorites handler...");
    await poolFavoritesHandler(oldDb, prisma);

    // INTERACTIONS
    log('info', "Starting Votes handler...");
    await postVotesHandler(oldDb, prisma);

    log('info', "Starting Favorites handler...");
    await postFavoritesHandler(oldDb, prisma);

    log('info', "Starting Boosts handler...");
    await postBoostsHandler(oldDb, prisma);

    log('info', "Starting Comments handler...");
    await postCommentsHandler(oldDb, prisma);

    log('info', "Finalizing...");
    await prisma.serverSettings.upsert({
      where: { id: 1 },
      update: {},
      create: {
        lastSetupVersion: '0.14.2', // last possible version before 2.0.0
        convertShortVids: OPTIONS.convertShortMuteVids,
        guestAccess: SETTINGS.guestViewing,
      }
    });

    log('success', "Successfully finished import! Enjoy!");
    return;

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
//                                                       Maps
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const roleMap = new Map<number, string>(); // old role id -> new role id

const tagRedirects = new Map<number, number>(); // merged old id -> id it was folded into
const skippedTags = new Set<number>();
const resolveTagId = (id: number) => skippedTags.has(id) ? null : (tagRedirects.get(id) ?? id);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                       Roles
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
type OldRole = {
  id: number,
  name: string,
  index: number,
  color: string | null,
  isDefault: boolean,
}

// Permissions get reset to new defaults, should prob let user know kek
async function rolesHandler(oldDb: SQL, prisma: PrismaClient) {
  const roles = await oldDb`
    SELECT * FROM "Role"
    ORDER BY id ASC
  ` as OldRole[];

  const newFormat = roles.map((r) => ({
    name: r.name,
    index: r.index,
    color: r.color ?? '#ffffff',
    isDefault: r.isDefault,
  }));

  await prisma.role.createMany({ data: newFormat, skipDuplicates: true });
  const allNew = await prisma.role.findMany({ select: { id: true, name: true } });
  const newIdByName = new Map(allNew.map((r) => [r.name, r.id]));

  for (const r of roles) {
    const newId = newIdByName.get(r.name);
    if (newId) roleMap.set(r.id, newId);
    else log('warn', `Role "${r.name}" didn't import`);
  }


  log('success', `Successfully imported ${allNew.length}/${roles.length} roles!`);
  return;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                       Users
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
type OldUser = {
  id: string, // cuid
  email: string,
  username: string,
  password: string, // hash
  role: OldRole | null,
  roleId: number | null,
  avatar: string | null,
  description: string | null,
  // preferences
  lastLogin: Date,
  createdAt: Date,
}

async function usersHandler(oldDb: SQL, prisma: PrismaClient) {
  // Start processing individually through batches
  let lastId = '';
  const BATCH = 500;
  const defaultRole = await prisma.role.findFirst({ where: { isDefault: true }, select: { id: true } });

  while (true) {
    const oldUsers = await oldDb`
      SELECT * FROM "User"
      WHERE id > ${lastId}
      ORDER BY id
      LIMIT ${BATCH}
    ` as OldUser[];
    if (oldUsers.length === 0) break; // nothing left

    const newFormat = oldUsers.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      passHash: u.password,
      roleId: roleMap.get(u.roleId ?? 1) ?? defaultRole!.id, // if the user setup v0.14 properly, id #1 should be Member
      avatarKey: userAvatar(u),
      about: u.description,
      lastLogin: u.lastLogin,
      createdAt: u.createdAt
    }));

    const { count } = await prisma.user.createMany({ data: newFormat, skipDuplicates: true });
    if (count < newFormat.length) log('warn', `${newFormat.length - count} users skipped (duplicate email/username)`);
    lastId = oldUsers[oldUsers.length - 1].id;
  }

  log('success', `Successfully imported users!`);
  return;
}

function userAvatar(old: OldUser): string | null {
  if (!old.avatar) { return null }; // bail instantly if they don't even have one lol
  try {
    const avatarKey = crypto.randomUUID();
    fs.copyFileSync(old.avatar, path.join(process.cwd(), 'data', 'avatars', `${avatarKey}.webp`));
    return avatarKey;
  } catch (e) {
    log('error', `Could not apply ${old.username}'s avatar! (It will be reset)`)
    return null;
  }
}

async function userPrefsHandler(oldDb: SQL, prisma: PrismaClient) {

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
  const DIRECTORIES = [
    "data/uploads/video",
    "data/uploads/image",
    "data/uploads/animated",
    "data/thumbnails",
    "data/previews/image",
    "data/previews/animated",
    "data/previews/video",
    "data/avatars",
  ]
  for (const dir of DIRECTORIES) { fs.mkdirSync(dir, { recursive: true }); };

  // Start processing individually through batches
  let lastId = 0;
  const BATCH = 500;
  const failedIds: number[] = [];

  while (true) {
    const posts = await oldDb`
      SELECT * FROM "Posts"
      WHERE id > ${lastId}
      ORDER BY id
      LIMIT ${BATCH}
    ` as OldPost[];
    if (posts.length === 0) break; // nothing left

    log('info', `Processing Posts #${posts[0].id} — #${posts[posts.length - 1].id}...`); // this is MY em dash and you cannot take it from me
    for (const post of posts) {
      const success = await importPost(oldDb, prisma, post, { old: oldDataDir, new: dataDir });
      if (!success) failedIds.push(post.id);
    }

    lastId = posts[posts.length - 1].id;
  }

  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Post"', 'id'), (SELECT MAX(id) FROM "Post"))`; // resync autoincrement()
  await prisma.$executeRaw`UPDATE "Tag" t SET "postCount" = (SELECT COUNT(*) FROM "PostTag" pt WHERE pt."tagId" = t.id)`;
}

// Posts handler components
async function importPost(oldDb: SQL, prisma: PrismaClient, post: OldPost, dataFolder: { old: string, new: string }): Promise<boolean> {
  // v0.12 stored originalPath as previewPath when it deleted an unneeded preview, those posts have no real preview
  if (post.previewPath?.startsWith('/data/uploads')) post.previewPath = null;
  if (!post.originalPath) { return false; } // literally an empty post (???)

  const oldOgPath = path.join(dataFolder.old, post.originalPath!.replace(/^\/data/, '')); // can't be asked to make this script work pre-v0.13.
  if (!fs.existsSync(oldOgPath)) { log('error', `Post #${post.id}: original file missing (${oldOgPath}), skipping...`); return false; }
  let oldPrvwPath = post.previewPath ? path.join(dataFolder.old, post.previewPath.replace(/^\/data/, '')) : null;

  if (oldPrvwPath && oldPrvwPath.endsWith('.null')) { log('warn', `Post #${post.id}: Preview has an invalid extension! Not copying it...`); oldPrvwPath = null };
  if (oldOgPath.endsWith('.null')) { log('error', `Post #${post.id}: Original has an invalid extension! Skipping post...`); return false; };
  
  const detected = await detectFileType(oldOgPath);
  const fileType = detected?.type ?? post.type?.toUpperCase();
  const fileExt = detected?.ext ?? post.fileExt;
  const fileKey = crypto.randomUUID();

  const typeDir = fileType!.toLowerCase();
  const storedOriginal = `/data/uploads/${typeDir}/${fileKey}.${fileExt}`;
  let storedPreview = post.previewPath ? `/data/previews/${typeDir}/${fileKey}${path.extname(post.previewPath)}` : null;


  // Copy files
  fs.copyFileSync(oldOgPath, path.join(process.cwd(), storedOriginal));
  try { if (oldPrvwPath && storedPreview) { fs.copyFileSync(oldPrvwPath, path.join(process.cwd(), storedPreview)); }; }
  catch (e) { log('warn', `Post #${post.id}: Preview doesn't exist on disk!`); oldPrvwPath = null; storedPreview = null; };
  
  for (const size of Object.keys(THUMBNAIL_SIZES)) {
    const oldPath = path.join(dataFolder.old, 'thumbnails', `${post.id}_${size}.webp`);
    const newPath = path.join(dataFolder.new, 'thumbnails', `${fileKey}_${size}.webp`);
    fs.copyFileSync(oldPath, newPath);
  }


  let previewMeta = null;
  const originalMeta = await fs.promises.stat(oldOgPath);
  if (oldPrvwPath) { previewMeta = await fs.promises.stat(oldPrvwPath); }

  const oldTagRows = await oldDb`SELECT "B" AS "tagId" FROM "_PostTags" WHERE "A" = ${post.id}` as { tagId: number }[];
  const tagIds = [...new Set(
    oldTagRows.map((r) => resolveTagId(r.tagId)).filter((id): id is number => id !== null)
  )];

  // Interaction counts are calculated later and added to posts

  let convertSafety: Safety = 'SAFE';
  switch (post.safety) {
    case 'SKETCHY': { convertSafety = 'QUESTIONABLE'; break; }
    case 'UNSAFE': { convertSafety = 'EXPLICIT'; break; }
  }

  let aspectRatio = post.aspectRatio;
  if (aspectRatio == null) {
    const { width, height } = await sharp(path.join(dataFolder.old, 'thumbnails', `${post.id}_${Object.keys(THUMBNAIL_SIZES)[0]}.webp`)).metadata();
    aspectRatio = width && height ? width / height : 1; // 1 = square fallback if even that fails
    log('warn', `Post #${post.id}: No aspect ratio! Measured ${aspectRatio.toFixed(3)} from its thumbnail`);
  }

  await prisma.post.create({
    data: {
      id: post.id,
      uploaderId: post.uploadedById,
      type: fileType! as FileType,
      originalPath: storedOriginal,
      previewPath: storedPreview,
      fileKey,
      safety: convertSafety,
      sources: post.sources,
      notes: post.notes,
      aspectRatio,
      fileSize: originalMeta.size,
      previewSize: previewMeta?.size,
      duration: post.duration,
      hasAudio: post.hasAudio,
      pHash: post.pHash,
      score: post.score,
      tagCount: tagIds.length,
      tags: { create: tagIds.map((tagId) => ({ tagId })) },
      createdAt: post.createdAt,
    },
  });

  return true;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                    Related Posts
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
type OldPostRelation = {
  fromId: number,
  toId: number,
}

async function relatedPostsHandler(oldDb: SQL, prisma: PrismaClient) {
  const oldRelations = await oldDb`SELECT "fromId", "toId" FROM "PostRelation"` as OldPostRelation[];

  // Only relate posts that actually made it to db (should be all of them, but just in case ig)
  const imported = await prisma.post.findMany({ select: { id: true } });
  const postIds = new Set(imported.map((p) => p.id));

  const newFormat: Prisma.PostRelationCreateManyInput[] = [];
  for (const r of oldRelations) {
    if (r.fromId === r.toId) continue; // can't relate a post to itself
    if (!postIds.has(r.fromId) || !postIds.has(r.toId)) continue;

    // v2 stores each pair once, smaller id first (same as relationPair() in Posts/manage.ts)
    newFormat.push(r.fromId < r.toId ? { fromId: r.fromId, toId: r.toId } : { fromId: r.toId, toId: r.fromId } );
  }

  const { count } = await prisma.postRelation.createMany({ data: newFormat, skipDuplicates: true });
  log('success', `Successfully imported ${count}/${oldRelations.length} post relations!`);
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                    Tag Categories
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
type OldTagCat = {
  id: number,
  name: string,
  color: string,
  order: number,
  isDefault: boolean,
  updatedAt: Date,
}

async function tagCatHandler(oldDb: SQL, prisma: PrismaClient) {
  const tagCats = await oldDb`
    SELECT * FROM "TagCategories"
    ORDER BY id ASC
  ` as OldTagCat[];

  const newFormat = tagCats.map((c) => ({
    id: c.id,
    name: c.name,
    index: c.order,
    color: c.color,
    isDefault: c.isDefault,
    updatedAt: c.updatedAt,
    createdAt: c.updatedAt, // we didn't store this before, so default to last updated instead of now lol
  }));

  await prisma.tagCategory.createMany({ data: newFormat, skipDuplicates: true });
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"TagCategory"', 'id'), (SELECT MAX(id) FROM "TagCategory"))`; // resync autoincrement()

  log('success', `Successfully imported ${newFormat.length}/${tagCats.length} categories!`);
  return;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                        Tags
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
type OldTag = {
  id: number,
  name: string, // main name
  description: string | null,
  categoryId: number,
  createdAt: Date,
}

async function tagHandler(oldDb: SQL, prisma: PrismaClient) {
  const tags = await oldDb`
    SELECT * FROM "Tags"
    ORDER BY id ASC
  ` as OldTag[];

  // Use route functions to create new tags
  const ownerByName = new Map<string, number>(); // normalized name -> old id that kept it
  const newFormat: Prisma.TagCreateManyInput[] = [];

  for (const tag of tags) {
    const result = normalizeTagName(tag.name);
    if (!result.ok) {
      skippedTags.add(tag.id);
      log('warn', `Tag #${tag.id} "${tag.name}" skipped: ${result.reason}`);
      continue;
    }

    const owner = ownerByName.get(result.name);
    if (owner !== undefined) { // collision: fold into the first tag with this name
      tagRedirects.set(tag.id, owner);
      log('warn', `Tag #${tag.id} "${tag.name}" merged into #${owner}`);
      continue;
    }

    ownerByName.set(result.name, tag.id);
    newFormat.push({
      id: tag.id,
      name: result.name,
      description: tag.description,
      categoryId: tag.categoryId,
      createdAt: tag.createdAt,
    });
  }

  await prisma.tag.createMany({ data: newFormat, skipDuplicates: true });
  await prisma.tagName.createMany({
    data: newFormat.map((t) => ({ name: t.name, tagId: t.id! })),
    skipDuplicates: true,
  });
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Tag"', 'id'), (SELECT MAX(id) FROM "Tag"))`; // resync autoincrement()

  log('success', `Successfully imported ${newFormat.length}/${tags.length} tags!`);
  return;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                        Tag Aliases
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
type OldTagAlias = {
  id: number,
  alias: string,
  tagId: number,
}

async function tagAliasHandler(oldDb: SQL, prisma: PrismaClient) {
  const aliases = await oldDb`
    SELECT * FROM "TagAlias"
    ORDER BY id ASC
  ` as OldTagAlias[];

  const newFormat: Prisma.TagNameCreateManyInput[] = [];

  for (const alias of aliases) {
    const tagId = resolveTagId(alias.tagId);
    if (tagId === null) continue; // its tag was skipped, so the alias goes with it

    const result = normalizeTagName(alias.alias);
    if (!result.ok) {
      log('warn', `Alias "${alias.alias}" (tag #${alias.tagId}) skipped: ${result.reason}`);
      continue;
    }

    newFormat.push({ name: result.name, tagId });
  }

  const { count } = await prisma.tagName.createMany({ data: newFormat, skipDuplicates: true });
  if (count < newFormat.length) log('warn', `${newFormat.length - count} aliases skipped (name already taken)`);

  log('success', `Successfully imported and attached ${count}/${aliases.length} tag aliases!`);
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                Tag Implications & Suggestions
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
type OldTagPair = { A: number, B: number };

// Resolve both ends through the redirects. Drop pairs that lost a tag or collapsed into one tag.
function remapPair(fromOld: number, toOld: number): [number, number] | null {
  const from = resolveTagId(fromOld);
  const to = resolveTagId(toOld);
  if (from === null || to === null || from === to) return null;
  return [from, to];
}

async function tagImpSuggHandler(old: SQL, prisma: PrismaClient) { // camimi moment
  // v0.14.2 stores these as Prisma implicit m2m tables, and the two use opposite column directions:
  //   _TagImplies:     A implies B   (looking_down_at_viewer -> looking_at_viewer)
  //   _TagSuggestions: B suggests A  (video -> 3d)

  const oldImplies = await old`SELECT "A", "B" FROM "_TagImplies"` as OldTagPair[];
  const oldSuggests = await old`SELECT "A", "B" FROM "_TagSuggestions"` as OldTagPair[];

  const implications: Prisma.TagImplicationCreateManyInput[] = [];
  for (const row of oldImplies) {
    const pair = remapPair(row.A, row.B);
    if (pair) implications.push({ tagId: pair[0], impliedId: pair[1] });
  }

  const suggestions: Prisma.TagSuggestionCreateManyInput[] = [];
  for (const row of oldSuggests) {
    const pair = remapPair(row.B, row.A); // flipped on purpose, see notes above
    if (pair) suggestions.push({ tagId: pair[0], suggestedId: pair[1] });
  }

  const imp = await prisma.tagImplication.createMany({ data: implications, skipDuplicates: true });
  const sugg = await prisma.tagSuggestion.createMany({ data: suggestions, skipDuplicates: true });

  log('success', `Successfully imported ${imp.count}/${oldImplies.length} tag implications!`);
  log('success', `Successfully imported ${sugg.count}/${oldSuggests.length} tag suggestions!`);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                        Pools
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
type OldPool = {
  id: number,
  name: string,
  artist: string | null,
  description: string | null,
  yearStart: number | null,
  yearEnd: number | null,
  lastEdited: Date,
  createdAt: Date,
}

type OldPoolItem = {
  poolId: number,
  postId: number,
  index: number,
}

async function poolsHandler(oldDb: SQL, prisma: PrismaClient) {
  const oldPools = await oldDb`SELECT * FROM "Pools" ORDER BY id ASC` as OldPool[];

  const newPools: Prisma.PoolCreateManyInput[] = oldPools.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.artist ? `Artist: ${p.artist}${p.description ? `\n\n${p.description}` : ''}` : p.description, // v2 has no artist field, so fallback to keeping them in desc
    yearStart: p.yearStart,
    yearEnd: p.yearEnd,
    updatedAt: p.lastEdited,
    createdAt: p.createdAt,
  }));

  await prisma.pool.createMany({ data: newPools, skipDuplicates: true });
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Pool"', 'id'), (SELECT MAX(id) FROM "Pool"))`; // resync autoincrement()

  // ITEMS
  // Ordered be pool, then old index, so we can renumber each pool 0..n-1 in one pass
  const oldItems = await oldDb`SELECT "poolId", "postId", "index" FROM "PoolItems" ORDER BY "poolId", "index"` as OldPoolItem[];

  const imported = await prisma.post.findMany({ select: { id: true } });
  const postIds = new Set(imported.map((p) => p.id));

  const nextIndex = new Map<number, number>(); // poolId -> next free index
  const newItems: Prisma.PoolPostCreateManyInput[] = [];
  
  for (const item of oldItems) {
    if (!postIds.has(item.postId)) { // post didn't import for some reason
      log('warn', `Skipping Post #${item.postId} for Pool #${item.poolId} because Post doesn't exist!`);
      continue;
    };

    const index = nextIndex.get(item.poolId) ?? 0;
    nextIndex.set(item.poolId, index + 1);
    newItems.push({ poolId: item.poolId, postId: item.postId, index });
  }

  const { count } = await prisma.poolPost.createMany({ data: newItems, skipDuplicates: true });
  log('success', `Successfully imported ${newPools.length} pools with ${count}/${oldItems.length} posts!`);
}
///////////////////////////////////
type OldPoolVote = {
  poolId: number,
  userId: string,
}

async function poolFavoritesHandler(oldDb: SQL, prisma: PrismaClient) {
  // Upvotes become favorites, downvotes are dropped
  const oldUpvotes = await oldDb`SELECT "poolId", "userId" FROM "PoolVotes" WHERE vote > 0` as OldPoolVote[];

  // Only users that actually imported (usersHandler can skip duplicates)
  const users = await prisma.user.findMany({ select: { id: true } });
  const userIds = new Set(users.map((u) => u.id));

  const newFormat: Prisma.PoolFavoriteCreateManyInput[] = oldUpvotes
    .filter((v) => userIds.has(v.userId))
    .map((v) => ({ poolId: v.poolId, userId: v.userId }));

  const { count } = await prisma.poolFavorite.createMany({ data: newFormat, skipDuplicates: true });
  await prisma.$executeRaw`UPDATE "Pool" p SET "favoriteCount" = (SELECT COUNT(*) FROM "PoolFavorite" pf WHERE pf."poolId" = p.id)`;

  log('success', `Successfully converted ${count}/${oldUpvotes.length} pool upvotes into favorites!`);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                      Interactions
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
type Interaction = {
  id: number,
  userId: string,
  postId: number,
  createdAt: Date,
}

async function postFavoritesHandler(oldDb: SQL, prisma: PrismaClient) {
  const users = await prisma.user.findMany({ select: { id: true } });
  const userIds = new Set(users.map((u) => u.id));
  const posts = await prisma.post.findMany({ select: { id: true } });
  const postIds = new Set(posts.map((p) => p.id));

  let lastId = 0;
  const BATCH = 5000; // rows are tiny compared to posts
  let imported = 0;

  while (true) {
    const oldFavs = await oldDb`
      SELECT id, "userId", "postId", "createdAt" FROM "UserFavorites"
      WHERE id > ${lastId}
      ORDER BY id
      LIMIT ${BATCH}
    ` as Interaction[];
    if (oldFavs.length === 0) break; // nothing left

    const newFormat: Prisma.PostFavoriteCreateManyInput[] = oldFavs
      .filter((f) => userIds.has(f.userId) && postIds.has(f.postId))
      .map((f) => ({ userId: f.userId, postId: f.postId, createdAt: f.createdAt }));
    
    const { count } = await prisma.postFavorite.createMany({ data: newFormat, skipDuplicates: true });
    imported += count;
    lastId = oldFavs[oldFavs.length - 1].id;
  }

  await prisma.$executeRaw`UPDATE "Post" p SET "favoriteCount" = (SELECT COUNT(*) FROM "PostFavorite" pf WHERE pf."postId" = p.id)`;

  log('success', `Successfully imported ${imported} post favorites!`);
}

async function postVotesHandler(oldDb: SQL, prisma: PrismaClient) {
  const users = await prisma.user.findMany({ select: { id: true } });
  const userIds = new Set(users.map((u) => u.id));
  const posts = await prisma.post.findMany({ select: { id: true } });
  const postIds = new Set(posts.map((p) => p.id));

  let lastId = 0;
  const BATCH = 5000; // rows are tiny compared to posts
  let imported = 0;

  while (true) {
    const oldVotes = await oldDb`
      SELECT id, "userId", "postId", type, "createdAt" FROM "Votes"
      WHERE id > ${lastId}
      ORDER BY id
      LIMIT ${BATCH}
    ` as { id: number, userId: string, postId: number, type: 'UPVOTE' | 'DOWNVOTE', createdAt: Date }[];
    if (oldVotes.length === 0) break; // nothing left

    const newFormat: Prisma.PostVoteCreateManyInput[] = oldVotes
      .filter((v) => userIds.has(v.userId) && postIds.has(v.postId))
      .map((v) => ({ userId: v.userId, postId: v.postId, value: v.type === 'UPVOTE' ? 1 : -1, createdAt: v.createdAt }));

    const { count } = await prisma.postVote.createMany({ data: newFormat, skipDuplicates: true });
    imported += count;
    lastId = oldVotes[oldVotes.length - 1].id;
  }

  // v2 score is always the sum of votes (see setVote in components/posts/interactions.ts)
  await prisma.$executeRaw`UPDATE "Post" p SET "score" = COALESCE((SELECT SUM(value) FROM "PostVote" pv WHERE pv."postId" = p.id), 0)`;

  log('success', `Successfully imported ${imported} post votes!`)
}

async function postBoostsHandler(oldDb: SQL, prisma: PrismaClient) {
  const users = await prisma.user.findMany({ select: { id: true } });
  const userIds = new Set(users.map((u) => u.id));
  const posts = await prisma.post.findMany({ select: { id: true } });
  const postIds = new Set(posts.map((p) => p.id));

  let lastId = 0;
  const BATCH = 5000;
  let imported = 0;

  while (true) {
    const oldBoosts = await oldDb`
      SELECT id, "userId", "postId", "createdAt" FROM "Boosts"
      WHERE id > ${lastId}
      ORDER BY id
      LIMIT ${BATCH}
    ` as Interaction[];
    if (oldBoosts.length === 0) break; // nothing left

    const newFormat: Prisma.PostBoostCreateManyInput[] = oldBoosts
      .filter((b) => userIds.has(b.userId) && postIds.has(b.postId))
      .map((b) => ({ id: b.id, userId: b.userId, postId: b.postId, createdAt: b.createdAt }));
    
    const { count } = await prisma.postBoost.createMany({ data: newFormat, skipDuplicates: true });
    imported += count;
    lastId = oldBoosts[oldBoosts.length - 1].id;
  }

  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"PostBoost"', 'id'), (SELECT MAX(id) FROM "PostBoost"))`; // resync autoincrement()
  await prisma.$executeRaw`UPDATE "Post" p SET "boostCount" = (SELECT COUNT(*) FROM "PostBoost" pb WHERE pb."postId" = p.id)`;

  // v2 reads cooldowns (and which boost is undoable) from User.lastBoostAt, so point it at each user's newest boost
  await prisma.$executeRaw`
    UPDATE "User" u SET "lastBoostAt" = b.latest
    FROM (SELECT "userId", MAX("createdAt") AS latest FROM "PostBoost" GROUP BY "userId") b
    WHERE u.id = b."userId"
  `;

  log('success', `Successfully imported ${imported} post boosts!`);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                       Comments
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
type OldComment = {
  id: number,
  postId: number,
  authorId: string,
  content: string,
  createdAt: Date,
  updatedAt: Date,
}

async function postCommentsHandler(oldDb: SQL, prisma: PrismaClient) {
  const users = await prisma.user.findMany({ select: { id: true } });
  const userIds = new Set(users.map((u) => u.id));
  const posts = await prisma.post.findMany({ select: { id: true } });
  const postIds = new Set(posts.map((p) => p.id));

  let lastId = 0;
  const BATCH = 2000; // comments carry text, so smaller batches than votes/favs
  let imported = 0;

  while (true) {
    const oldComments = await oldDb`
      SELECT id, "postId", "authorId", content, "createdAt", "updatedAt" FROM "Comments"
      WHERE id > ${lastId}
      ORDER BY id
      LIMIT ${BATCH}
    ` as OldComment[];
    if (oldComments.length === 0) break; // nothing left

    const newFormat: Prisma.PostCommentCreateManyInput[] = oldComments
      .filter((c) => userIds.has(c.authorId) && postIds.has(c.postId))
      .map((c) => ({
        id: c.id,
        postId: c.postId,
        authorId: c.authorId,
        content: c.content, // embeds (":123:" and links) are parsed from content at read time, so isEmbed isn't needed
        // v0.14's @updatedAt was set on create too, so only set it if it's clearly later
        editedAt: c.updatedAt.getTime() - c.createdAt.getTime() > 1000 ? c.updatedAt : null,
        createdAt: c.createdAt,
      }));

    const { count } = await prisma.postComment.createMany({ data: newFormat, skipDuplicates: true });
    imported += count;
    lastId = oldComments[oldComments.length - 1].id;
  }

  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"PostComment"', 'id'), (SELECT MAX(id) FROM "PostComment"))`; // resync autoincrement()

  log('success', `Successfully imported ${imported} comments!`);
}


main(); // run script
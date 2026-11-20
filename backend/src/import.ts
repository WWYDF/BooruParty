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
import { resolveTagNames } from "./core/utilities/tags";
import { detectFileType } from "./components/uploads/receive";
import { THUMBNAIL_SIZES } from "./components/uploads/thumbnails";
import { parseArgs } from "util";

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
    if (!values) { OLD_DATABASE = await getOldDb(); }
    else { OLD_DATABASE = { host: values.host ?? 'localhost', port: Number(values.port ?? 5432), username: values.username!, password: values.password!, name: values.database! } };
    
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
    let ready = false;
    if (values && values.force) { ready = true }
    else { ready = await confirm({ message: 'Continue?', default: false }); }
    if (!ready) { log('info', "Cancelled."); process.exit(0); };

    // BEGIN: Call import handlers
    log('info', "Starting Role handler...");
    await rolesHandler(oldDb, prisma);

    log('info', "Starting Users handler...");
    await usersHandler(oldDb, prisma);

    log('info', "Starting Tag Categories handler...");
    await tagCatHandler(oldDb, prisma);
    
    // handle posts as late as possible since its the slowest
    log('info', "Starting Posts handler...");
    await postsHandler(oldDb, prisma);


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
const userMap = new Map<string, string>(); // old id -> new id

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
      // drop avatars for now
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

    for (const post of posts) {
      const success = await importPost(oldDb, prisma, post, { old: oldDataDir, new: dataDir });
      if (!success) failedIds.push(post.id);
    }

    await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Post"', 'id'), (SELECT MAX(id) FROM "Post"))`; // resync autoincrement()
    lastId = posts[posts.length - 1].id;
  }
}

// Posts handler components
async function importPost(oldDb: SQL, prisma: PrismaClient, post: OldPost, dataFolder: { old: string, new: string }): Promise<boolean> {
  log('info', `Processing Post #${post.id}...`);
  const oldOgPath = path.join(dataFolder.old, post.originalPath!.replace(/^\/data/, '')); // can't be asked to make this script work pre-v0.13.
  const oldPrvwPath = post.previewPath ? path.join(dataFolder.old, post.previewPath.replace(/^\/data/, '')) : null;
  
  const detected = await detectFileType(oldOgPath);
  const fileType = detected?.type ?? post.type;
  const fileExt = detected?.ext ?? post.fileExt;
  const fileKey = crypto.randomUUID();
  
  const originalPath = path.join(dataFolder.new, 'uploads', `${fileType!.toLowerCase()}`, `${fileKey}.${fileExt}`);
  let previewPath = null;
  if (post.previewPath) { previewPath = path.join(dataFolder.new, post.previewPath.replace(/^\/data/, '')); }

  // Copy files
  fs.copyFileSync(oldOgPath, originalPath);
  if (oldPrvwPath && previewPath && post.previewPath) { fs.copyFileSync(oldPrvwPath, previewPath); };
  for (const size of Object.keys(THUMBNAIL_SIZES)) {
    const oldPath = path.join(dataFolder.old, 'thumbnails', `${post.id}_${size}.webp`);
    const newPath = path.join(dataFolder.new, 'thumbnails', `${fileKey}_${size}.webp`);
    fs.copyFileSync(oldPath, newPath);
  }


  let previewMeta = null;
  const originalMeta = await fs.promises.stat(oldOgPath);
  if (oldPrvwPath) { previewMeta = await fs.promises.stat(oldPrvwPath); }

  await prisma.$transaction(async (tx) => {
    // const { tags: found, missing } = await resolveTagNames(tags, tx);
    // const tagIds = [...new Set([...found, ...autoFound].map((t) => t.id))];

    let convertSafety: Safety = 'SAFE';
    switch (post.safety) {
      case 'SKETCHY': { convertSafety = 'QUESTIONABLE' }
      case 'UNSAFE': { convertSafety = 'EXPLICIT' }
    }

    // Grab interaction counts
    const [{ boostCount }] = await oldDb`
      SELECT COUNT(*)::int AS "boostCount" FROM "Boosts" WHERE "postId" = ${post.id}
    `;

    const [{ favoriteCount }] = await oldDb`
      SELECT COUNT(*)::int AS "favoriteCount" FROM "UserFavorites" WHERE "postId" = ${post.id}
    `;

    await tx.post.create({
      data: {
        id: post.id,
        uploaderId: post.uploadedById,
        type: fileType! as FileType,
        originalPath,
        previewPath,
        fileKey,
        safety: convertSafety,
        sources: post.sources,
        notes: post.notes,
        aspectRatio: post.aspectRatio,
        fileSize: originalMeta.size,
        previewSize: previewMeta?.size,
        duration: post.duration,
        hasAudio: post.hasAudio,
        pHash: post.pHash,
        score: post.score,
        boostCount,
        favoriteCount,
      },
    });

    // if (tagIds.length) {
    //   await tx.tag.updateMany({ where: { id: { in: tagIds } }, data: { postCount: { increment: 1 } } });
    // }
  });

  return true;
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



main(); // run script
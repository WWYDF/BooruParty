// This is an independant importer script designed to help you transition from v0.14.2 to v2.0.0.
// This only runs if you specifically call it to run with `bun importdata`.

// Please backup your postgres database and backend data folder.
// This script is only intended to be run once, it will bail if v2 is already setup.

// Sorry if this file is a bit messy, I want to keep everything in one file the best I can.

import { confirm, input, number, password, select } from "@inquirer/prompts";
import chalk from "chalk";
import { SQL } from "bun";
import { PrismaClient } from "../prisma/client";

const old_ver = 'v0.14';

const c = { debug: chalk.gray, info: chalk.cyan, success: chalk.green, warn: chalk.yellow, error: chalk.red.bold, critical: chalk.bgRed.whiteBright };
export const log = (level: keyof typeof c, ...args: unknown[]) => console.log(c[level](`[${level.toUpperCase()}]`), ...args);

// First we need to get a bunch of data from the user through inquirer
// This is not kept between attempts, so I recommend opening notepad lol
type Database = {
  name: string,
  port: number,
  username: string,
  password: string,
}

async function getOldDb(): Promise<Database> {
  console.clear();
  const pfx = old_ver; // in case I change it later
  const name = await input({
    message: `${pfx} Database Name`,
    default: 'database',
    required: true,
    validate: (v) => v.trim().length > 0 || 'Required',
  });

  const port = await number({
    message: `${pfx} Database Port`,
    default: 5432,
    required: true,
  });

  const username = await input({
    message: `${pfx} Postgres Username`,
    default: 'username',
    required: true,
    validate: (v) => v.trim().length > 0 || 'Required',
  });

  const pwd = await password({
    message: `${pfx} Postgres Password`,
    mask: '*',
  });

  return { name, port, username, password: pwd };
}

async function getNewDb(): Promise<Database> {
  console.clear();
  log('warn', "Please make sure the new database already exists in psql.");
  const pfx = 'New'; // in case I change it later
  const name = await input({
    message: `${pfx} Database Name`,
    default: 'boorupartyv2',
    required: true,
    validate: (v) => v.trim().length > 0 || 'Required',
  });

  const port = await number({
    message: `${pfx} Database Port`,
    default: 5432,
    required: true,
  });

  const username = await input({
    message: `${pfx} Postgres Username`,
    default: 'bpUser',
    required: true,
    validate: (v) => v.trim().length > 0 || 'Required',
  });

  const pwd = await password({
    message: `${pfx} Postgres Password`,
    mask: '*',
  });

  return { name, port, username, password: pwd };
}


// Get Site Settings
type SiteSettings = {
  frontendDomain: string,
  backendDomain: string,
  guestViewing: boolean, // change guest safety in dashboard later
  // add mailgun/smtp here later
}

async function getSiteSettings(): Promise<SiteSettings> {
  console.clear();
  log('warn', "Please no trailing slashes on URLs. (a good URL looks like https://example.booru.party");
  const frontendDomain = await input({
    message: `Frontend Site URL`,
    required: true,
    validate: (v) => { try { return ['http:', 'https:'].includes(new URL(v).protocol) || 'Must be http(s)'; } catch { return 'Invalid URL'; } },
  });

  const backendDomain = await input({
    message: `Backend Site URL`,
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
          disabled: (selectedEncoder !== 'qsv' && selectedEncoder !== 'cpu') && 'Not compatible with selected device'
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
          disabled: (selectedEncoder == 'amf') && 'Not compatible with selected device'
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
async function checkReadEnv() {
  
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                       Main
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function main() {
  log('info', "This is an independent importer script designed to help you transition from v0.14.2 to v2.0.0.");
  log('info', "Please backup your postgres database and backend data folder.");

  let oldDb: SQL | undefined;
  let prisma: PrismaClient | undefined;

  try {
    // Use inquierer to get required fields from the user
    const OLD_DATABASE = await getOldDb();
    const NEW_DATABSE = await getNewDb();
    const SETTINGS = await getSiteSettings();
    const OPTIONS = await getBackendOpts();
    
    console.clear();

    // Validate database connections
    log('info', 'Validating database connections...');
    prisma = new PrismaClient({ datasourceUrl: `postgresql://${NEW_DATABSE.username}:${encodeURIComponent(NEW_DATABSE.password)}@localhost:${NEW_DATABSE.port}/${NEW_DATABSE.name}` });
    oldDb = new SQL({ hostname: 'localhost', port: OLD_DATABASE.port, database: OLD_DATABASE.name, username: OLD_DATABASE.username, password: OLD_DATABASE.password });

    const [oldSettings] = await oldDb`SELECT * FROM "SiteSettings" WHERE id = 1`;
    if (!oldSettings || oldSettings.setupComplete) { throw new Error(`${old_ver} database is empty or not set up yet!`) };
    const isDbOccupied = await prisma.serverSettings.findFirst({ where: { id: 1 } });
    if (isDbOccupied && isDbOccupied.lastSetupVersion) { throw new Error("New database isn't empty! Please clear it first.") };

    log('info', '');

    // after all inquirer fields are asked and dbs are validated that they can connect
    // log('warn', "This script is only intended to be run once, so please confirm you are ready.")
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


main(); // run script
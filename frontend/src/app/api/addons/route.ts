import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { auth } from '@/core/authServer';
import { checkPermissions } from '@/components/serverSide/permCheck';
import { AddonState, AutotagMode } from '@/core/types/dashboard';

type Payload = {
  artistProfileEnabled?: boolean;

  autotagger?: {
    enabled: boolean;
    url?: string | null;
    mode?: AutotagMode | AutotagMode[];
  };

  jigsaw?: {
    enabled: boolean;
    vagueTagName?: string[];
  };
};

export async function GET() {
  const cfg = await prisma.addonsConfig.findUnique({ where: { id: 1 } });
  const row = cfg ?? (await prisma.addonsConfig.create({ data: { id: 1 } }));

  return NextResponse.json({
    artistProfile: { enabled: row.artistProfiles },
    autotagger: {
      enabled: row.autoTagger,
      url: row.autoTaggerUrl ?? '',
      mode: row.autoTaggerMode,
    },
    jigsaw: {
      enabled: row.jigsaw,
      vagueTagName: row.vagueTagName ?? [],
    },
    updatedAt: row.updatedAt,
  });
}


export async function PUT(req: NextRequest) {
  const session = await auth();
  const hasPerms = (await checkPermissions(['dashboard_addons']))['dashboard_addons'];

  if (!session && !hasPerms) { return NextResponse.json({ error: 'You are unauthorized to manage addons.' }, { status: 403 }); };

  const body = (await req.json()) as Payload;

  // Artist Profiles Config
  const artistProfiles =
    typeof body.artistProfileEnabled === 'boolean'
      ? body.artistProfileEnabled
      : undefined;

  // AutoTagger Config
  let autoTagger: boolean | undefined;
  let autoTaggerUrl: string | null | undefined;
  let autoTaggerMode: AutotagMode[] | undefined;

  if (body.autotagger) {
    const { enabled, url, mode } = body.autotagger;
    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'autotagger.enabled must be boolean' },
        { status: 400 }
      );
    }
    autoTagger = enabled;
  
    if (enabled) {
      if (url && !/^https?:\/\/.+/i.test(url)) {
        return NextResponse.json(
          { error: 'autotagger.url must be a valid http(s) URL' },
          { status: 400 }
        );
      }
      autoTaggerUrl = url ?? null;
  
      if (mode !== undefined) {
        const arr = Array.isArray(mode) ? mode : [mode];
        const allowed: AutotagMode[] = ['PASSIVE', 'AGGRESSIVE', 'SELECTIVE'];
        if (!arr.every(m => allowed.includes(m))) {
          return NextResponse.json(
            { error: 'autotagger.mode must be PASSIVE, AGGRESSIVE, or SELECTIVE' },
            { status: 400 }
          );
        }
        autoTaggerMode = arr;
      } else {
        // default at least one mode when enabled
        autoTaggerMode = ['PASSIVE'];
      }
    } else {
      autoTaggerUrl = null;
      // store a default when disabled (keeps previous behavior)
      autoTaggerMode = ['PASSIVE'];
    }
  }

  // Jigsaw Config
  let jigsaw: boolean | undefined;
  let vagueTagName: string[] | undefined;

  if (body.jigsaw) {
    const { enabled, vagueTagName: vagueNames } = body.jigsaw;
    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'jigsaw.enabled must be boolean' },
        { status: 400 }
      );
    }
    jigsaw = enabled;

    if (enabled) {
      if (!Array.isArray(vagueNames) || vagueNames.length === 0) {
        return NextResponse.json(
          { error: 'jigsaw.vagueTagName must be a non-empty array when jigsaw is enabled' },
          { status: 400 }
        );
      }
      // Filter out empty strings
      vagueTagName = vagueNames.filter(name => name.trim().length > 0);
      
      if (vagueTagName.length === 0) {
        return NextResponse.json(
          { error: 'jigsaw.vagueTagName must contain at least one non-empty tag' },
          { status: 400 }
        );
      }
    } else {
      vagueTagName = [];
    }
  }

  const updated = await prisma.addonsConfig.update({
    where: { id: 1 },
    data: {
      ...(artistProfiles !== undefined && {
        artistProfiles,
      }),
      ...(autoTagger !== undefined && {
        autoTagger,
      }),
      ...(autoTaggerUrl !== undefined && {
        autoTaggerUrl,
      }),
      ...(autoTaggerMode !== undefined && {
        autoTaggerMode,
      }),
      ...(jigsaw !== undefined && {
        jigsaw,
      }),
      ...(vagueTagName !== undefined && {
        vagueTagName,
      }),
    },
  });

  const respond: AddonState = {
    artistProfile: { enabled: updated.artistProfiles },
    autotagger: {
      enabled: updated.autoTagger,
      url: updated.autoTaggerUrl ?? '',
      mode: updated.autoTaggerMode,
    },
    jigsaw: {
      enabled: updated.jigsaw,
      vagueTagName: Array.isArray(updated.vagueTagName) ? updated.vagueTagName : [],
    },
    updatedAt: updated.updatedAt,
  }

  return NextResponse.json({
    ok: true,
    addons: respond,
  });
}
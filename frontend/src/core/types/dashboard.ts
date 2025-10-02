export type AutotagMode = 'PASSIVE' | 'AGGRESSIVE';

export type AddonState = {
  artistProfile: {
    enabled: boolean;
  };
  autotagger: AutoTaggerSettings
};

export type AutoTaggerSettings = {
  enabled: boolean;
  url: string;
  mode: AutotagMode[];
}

// Based on Danbooru's Version
export type AutoTaggerShape = {
  filename: string;
  tags: Record<string, number>;
}[];
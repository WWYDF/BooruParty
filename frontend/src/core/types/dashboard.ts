export type AutotagMode = 'PASSIVE' | 'AGGRESSIVE' | 'SELECTIVE';

export type AddonState = {
  artistProfile: {
    enabled: boolean;
  };
  autotagger: AutoTaggerSettings,
  jigsaw: JigsawShape,
  updatedAt: Date,
};

export type AutoTaggerSettings = {
  enabled: boolean;
  url: string;
  mode: AutotagMode[];
}
// wd-14 output
export type Wd14Confidence = {
  label: string;
  confidence: number;
};

export type AutoTaggerShape = {
  label: string;
  confidences: Wd14Confidence[];
};

export type JigsawShape = {
  enabled: boolean,
  vagueTagName: string[],
};
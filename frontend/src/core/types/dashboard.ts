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
// wd-14 output
export type Wd14Confidence = {
  label: string;
  confidence: number;
};

export type AutoTaggerShape = {
  label: string;
  confidences: Wd14Confidence[];
};
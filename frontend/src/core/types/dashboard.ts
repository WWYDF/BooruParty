export type AutotagMode = 'PASSIVE' | 'AGGRESSIVE';

export type AddonState = {
  artistProfile: {
    enabled: boolean;
  };
  autotagger: {
    enabled: boolean;
    url: string;
    mode: AutotagMode;
  };
};

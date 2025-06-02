// encoders.ts
export type EncoderConfig = {
  encoder: string;
  qualityFlag: '-crf' | '-cq';
  qualityValue: number;
  preset?: string;
  profile?: string;
  extraArgs?: string[];
};

export const ENCODER_PRIORITY_MAP: Record<string, string[]> = {
  h264: ['h264_nvenc', 'h264_qsv', 'h264_amf', 'libx264'],
  vp9: ['vp9_qsv', 'libvpx-vp9'],
  av1: ['av1_nvenc', 'av1_qsv', 'av1_amf', 'libaom-av1', 'svt_av1'],
  h265: ['hevc_nvenc', 'hevc_qsv', 'hevc_amf', 'libx265'],
};

export const ENCODER_OPTIONS_MAP: Record<string, EncoderConfig> = {
  libx264: {
    encoder: 'libx264',
    qualityFlag: '-crf',
    qualityValue: 32,
    preset: 'fast',
    profile: 'high',
  },
  h264_nvenc: {
    encoder: 'h264_nvenc',
    qualityFlag: '-cq',
    qualityValue: 30,
    preset: 'p4',
    profile: 'high',
  },
  h264_qsv: {
    encoder: 'h264_qsv',
    qualityFlag: '-crf',
    qualityValue: 30,
    preset: 'medium',
  },
  h264_amf: {
    encoder: 'h264_amf',
    qualityFlag: '-cq',
    qualityValue: 28,
    extraArgs: ['-usage', 'transcoding'],
  },
  libvpx_vp9: {
    encoder: 'libvpx-vp9',
    qualityFlag: '-crf',
    qualityValue: 32,
    preset: 'good',
    extraArgs: ['-b:v', '0', '-deadline', 'realtime'],
  },
  av1_nvenc: {
    encoder: 'av1_nvenc',
    qualityFlag: '-cq',
    qualityValue: 33,
    preset: 'p4',
  },
  libaom_av1: {
    encoder: 'libaom-av1',
    qualityFlag: '-crf',
    qualityValue: 33,
    preset: 'good',
  },
  libx265: {
    encoder: 'libx265',
    qualityFlag: '-crf',
    qualityValue: 28,
    preset: 'medium',
  },
  hevc_nvenc: {
    encoder: 'hevc_nvenc',
    qualityFlag: '-cq',
    qualityValue: 28,
    preset: 'p5',
  },
  hevc_qsv: {
    encoder: 'hevc_qsv',
    qualityFlag: '-crf',
    qualityValue: 28,
    preset: 'medium',
  },
  hevc_amf: {
    encoder: 'hevc_amf',
    qualityFlag: '-cq',
    qualityValue: 28,
    preset: 'speed',
  },
};
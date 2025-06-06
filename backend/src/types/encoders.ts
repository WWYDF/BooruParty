// encoders.ts
export type EncoderConfig = {
  encoder: string;
  qualityFlag?: '-crf' | '-cq';
  qualityValue?: number;
  preset?: string;
  profile?: string;
  extraArgs?: string[];
  filters?: string;
  container: 'mp4' | 'webm' | 'mkv';
};

export const ENCODER_PRIORITY_MAP: Record<string, string[]> = {
  h264: ['h264_nvenc', 'h264_qsv', 'h264_amf', 'libx264'],
  vp9: ['vp9_qsv', 'libvpx-vp9'],
  av1: ['av1_nvenc', 'av1_qsv', 'av1_amf', 'libsvtav1', 'svt_av1'],
  h265: ['hevc_nvenc', 'hevc_qsv', 'hevc_amf', 'libx265'],
};

export const ENCODER_OPTIONS_MAP: Record<string, EncoderConfig> = {
  libx264: { // done
    encoder: 'libx264', // works
    qualityFlag: '-crf',
    qualityValue: 26,
    preset: 'medium',
    container: 'mp4'
  },
  h264_nvenc: { // done
    encoder: 'h264_nvenc', // works
    qualityFlag: '-cq',
    qualityValue: 30,
    preset: 'p4',
    profile: 'high',
    container: 'mp4'
  },
  h264_qsv: {
    encoder: 'h264_qsv',
    qualityFlag: '-crf',
    qualityValue: 30,
    preset: 'medium',
    container: 'mp4'
  },
  h264_amf: { // not really working
    encoder: 'h264_amf',
    qualityFlag: '-cq',
    qualityValue: 32,
    preset: 'balanced',
    container: 'mp4'
  },
  libvpx_vp9: { // done
    encoder: 'libvpx-vp9', // // working
    qualityFlag: '-crf',
    qualityValue: 32,
    extraArgs: ['-b:v', '0', '-deadline', 'realtime', '-cpu-used', '5'],
    container: 'webm'
  },
  vp9_qsv: {
    encoder: 'vp9_qsv',
    preset: '4',
    extraArgs: ['-b:v', '3M'],
    filters: 'hwupload=extra_hw_frames=64,scale_qsv=1280:-1',
    container: 'webm'
  },
  av1_nvenc: { // good
    encoder: 'av1_nvenc', // works
    qualityFlag: '-cq',
    qualityValue: 33,
    preset: 'p4', // try adjusting this to p5 and retest?
    container: 'mp4'
  },
  svt_av1: { // VERY good
    encoder: 'libsvtav1', // works
    qualityFlag: '-crf',
    qualityValue: 33,
    preset: '5',
    container: 'mp4'
  },
  libx265: { // very good
    encoder: 'libx265', // works
    qualityFlag: '-crf',
    qualityValue: 26,
    preset: 'slow',
    container: 'mp4'
  },
  hevc_nvenc: { // good
    encoder: 'hevc_nvenc', // works
    qualityFlag: '-cq',
    qualityValue: 30,
    preset: 'p7',
    container: 'mp4'
  },
  hevc_qsv: {
    encoder: 'hevc_qsv',
    qualityFlag: '-crf',
    qualityValue: 28,
    preset: 'medium',
    container: 'mp4'
  },
  hevc_amf: { // not working
    encoder: 'hevc_amf',
    qualityFlag: '-cq',
    qualityValue: 28,
    preset: 'balanced',
    container: 'mp4'
  },
};
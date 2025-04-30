export const ENCODER_PRIORITY_MAP: Record<string, string[]> = {
  h264: ['h264_nvenc', 'h264_qsv', 'h264_amf', 'libx264'],
  vp9: ['vp9_qsv', 'libvpx-vp9'],
  av1: ['av1_nvenc', 'av1_qsv', 'av1_amf', 'libaom-av1', 'svt_av1'],
  h265: ['hevc_nvenc', 'hevc_qsv', 'hevc_amf', 'libx265'],
};

export const PRESET_MAP: Record<string, string> = {
  libvpx_vp9: 'good',
  libx264: 'fast',
  h264_nvenc: 'p4',
  av1_nvenc: 'p4',
  libaom_av1: 'good',
};
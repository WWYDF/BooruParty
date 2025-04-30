export const ENCODER_PRIORITY = [
  'h264_nvenc',  // NVIDIA GPU
  'h264_qsv',    // Intel QuickSync
  'h264_videotoolbox', // macOS
  'h264_amf',    // AMD GPU
  'libx264'      // Software fallback
];
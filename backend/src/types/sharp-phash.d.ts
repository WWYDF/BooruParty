declare module 'sharp-phash' {
  export default function phash(image: string | Buffer): Promise<string>;
}

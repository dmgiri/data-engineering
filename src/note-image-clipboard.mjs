export const SUPPORTED_NOTE_IMAGE_TYPES=['image/png','image/jpeg','image/webp','image/gif'];

const MAX_NOTE_IMAGE_BYTES=2*1024*1024;

export function validateNoteImage(file){
  if(!SUPPORTED_NOTE_IMAGE_TYPES.includes(file?.type))return 'Choose a PNG, JPEG, WebP, or GIF image.';
  if(file.size>MAX_NOTE_IMAGE_BYTES)return 'Keep each note image under 2 MB.';
  return null;
}

export function clipboardImage(items){
  for(const item of Array.from(items||[])){
    if(item.kind!=='file'||!SUPPORTED_NOTE_IMAGE_TYPES.includes(item.type))continue;
    const file=item.getAsFile?.();
    if(file)return file;
  }
  return null;
}

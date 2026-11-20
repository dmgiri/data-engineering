import test from 'node:test';
import assert from 'node:assert/strict';

const module=await import('../src/note-image-clipboard.mjs').catch(()=>({}));
const clipboardImage=module.clipboardImage||(()=>null);
const validateNoteImage=module.validateNoteImage||(()=>null);

const item=(kind,type,file)=>({kind,type,getAsFile:()=>file});

test('selects the first supported clipboard image and ignores text or unsupported files',()=>{
  const jpeg={name:'diagram.jpg',type:'image/jpeg',size:1200};
  const png={name:'later.png',type:'image/png',size:900};
  const selected=clipboardImage([
    item('string','text/plain',null),
    item('file','image/bmp',{name:'legacy.bmp',type:'image/bmp',size:500}),
    item('file','image/jpeg',jpeg),
    item('file','image/png',png)
  ]);
  assert.equal(selected,jpeg);
});

test('returns no image when clipboard data has no supported image file',()=>{
  assert.equal(clipboardImage([]),null);
  assert.equal(clipboardImage([item('file','application/pdf',{name:'notes.pdf',type:'application/pdf',size:300})]),null);
});

test('validates supported note images against the two megabyte limit',()=>{
  assert.equal(validateNoteImage({type:'image/png',size:2*1024*1024}),null);
  assert.equal(validateNoteImage({type:'image/webp',size:2*1024*1024+1}),'Keep each note image under 2 MB.');
  assert.equal(validateNoteImage({type:'image/svg+xml',size:100}),'Choose a PNG, JPEG, WebP, or GIF image.');
});

import { PinataSDK } from 'pinata';
import dotenv from 'dotenv';

dotenv.config();

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT
});

console.log('Pinata object keys:', Object.keys(pinata));
console.log('Pinata.upload:', pinata.upload);
if (pinata.upload) {
  console.log('Pinata.upload keys:', Object.keys(pinata.upload));
}

// Test upload
const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
try {
  const result = await pinata.upload.public.file(file);
  console.log('✅ Direct upload.file() success:', result);
} catch (e) {
  console.log('❌ Direct upload.file() failed:', e.message);
  
  // Try upload.public.file()
  try {
    const result2 = await pinata.upload.public.file(file);
    console.log('✅ upload.public.file() success:', result2);
  } catch (e2) {
    console.log('❌ upload.public.file() failed:', e2.message);
  }
}

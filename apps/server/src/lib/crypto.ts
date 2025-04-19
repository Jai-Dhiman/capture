import nacl from 'tweetnacl';

export async function generateImageSignature(
  imageId: string,
  variant: string,
  expiry: number,
  key: string,
): Promise<string> {
  const message = `/${imageId}/${variant}${expiry}`;

  const keyBytes = ensureKeySize(key);

  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(message);

  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(messageBytes, nonce, keyBytes);

  const fullSignature = new Uint8Array(nonce.length + box.length);
  fullSignature.set(nonce);
  fullSignature.set(box, nonce.length);

  return uint8ArrayToHex(fullSignature);
}

function hexToUint8Array(hexString: string): Uint8Array {
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
  }
  return bytes;
}

function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function ensureKeySize(key: string): Uint8Array {
  let keyBytes: Uint8Array;

  if (/^[0-9a-fA-F]+$/.test(key)) {
    keyBytes = hexToUint8Array(key);
  } else {
    keyBytes = new TextEncoder().encode(key);
  }

  if (keyBytes.length < 32) {
    const paddedKey = new Uint8Array(32);
    paddedKey.set(keyBytes);
    return paddedKey;
  }

  if (keyBytes.length > 32) {
    return keyBytes.slice(0, 32);
  }

  return keyBytes;
}

export async function verifyImageSignature(
  imageId: string,
  variant: string,
  expiry: number,
  signature: string,
  key: string,
): Promise<boolean> {
  if (expiry < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const message = `/${imageId}/${variant}${expiry}`;
  const keyBytes = ensureKeySize(key);
  const signatureBytes = hexToUint8Array(signature);

  const nonce = signatureBytes.slice(0, nacl.secretbox.nonceLength);
  const box = signatureBytes.slice(nacl.secretbox.nonceLength);

  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(message);

  try {
    const decrypted = nacl.secretbox.open(box, nonce, keyBytes);
    if (!decrypted) return false;

    const decoder = new TextDecoder();
    return decoder.decode(decrypted) === message;
  } catch (error) {
    return false;
  }
}

export async function generateImageSignature(
  imageId: string,
  variant: string,
  expiry: number,
  key: string
): Promise<string> {
  const message = `/${imageId}/${variant}${expiry}`

  // Convert the key from hex to an array buffer
  const keyData = hexToArrayBuffer(key)

  // Import the key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  // Sign the message
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data)

  // Convert signature to hex string
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Helper to convert hex string to array buffer
function hexToArrayBuffer(hexString: string): ArrayBuffer {
  const bytes = new Uint8Array(hexString.length / 2)
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substr(i, 2), 16)
  }
  return bytes.buffer
}

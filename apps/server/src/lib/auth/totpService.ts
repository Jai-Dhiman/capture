import { createHash, randomBytes } from 'crypto';

export class TotpService {
  private static readonly DIGITS = 6;
  private static readonly PERIOD = 30; // 30 seconds
  private static readonly WINDOW = 1; // Allow 1 period before/after for clock drift
  private static readonly SECRET_LENGTH = 32; // 32 bytes = 256 bits

  /**
   * Generate a random base32-encoded secret for TOTP
   */
  static generateSecret(): string {
    const buffer = randomBytes(this.SECRET_LENGTH);
    return this.base32Encode(buffer);
  }

  /**
   * Generate TOTP value for a given secret and time
   */
  static generateTOTP(secret: string, timeStepNumber?: number): string {
    const secretBuffer = this.base32Decode(secret);
    const time = timeStepNumber ?? Math.floor(Date.now() / 1000 / this.PERIOD);
    
    // Convert time to 8-byte big-endian buffer
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeUInt32BE(Math.floor(time / 0x100000000), 0);
    timeBuffer.writeUInt32BE(time & 0xffffffff, 4);

    // HMAC-SHA1
    const hmac = createHash('sha1');
    hmac.update(Buffer.concat([secretBuffer, timeBuffer]));
    const hash = hmac.digest();

    // Dynamic truncation
    const offset = hash[hash.length - 1] & 0x0f;
    const code = ((hash[offset] & 0x7f) << 24) |
                 ((hash[offset + 1] & 0xff) << 16) |
                 ((hash[offset + 2] & 0xff) << 8) |
                 (hash[offset + 3] & 0xff);

    // Return 6-digit code
    return (code % Math.pow(10, this.DIGITS)).toString().padStart(this.DIGITS, '0');
  }

  /**
   * Verify TOTP code with time window tolerance
   */
  static verifyTOTP(secret: string, token: string): boolean {
    const currentTime = Math.floor(Date.now() / 1000 / this.PERIOD);
    
    // Check current time window and adjacent windows for clock drift
    for (let i = -this.WINDOW; i <= this.WINDOW; i++) {
      const timeStep = currentTime + i;
      const expectedToken = this.generateTOTP(secret, timeStep);
      
      if (this.constantTimeCompare(token, expectedToken)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Generate QR code data URL for TOTP setup
   */
  static generateQRCodeData(secret: string, userEmail: string, issuer: string = 'Capture'): string {
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedEmail = encodeURIComponent(userEmail);
    const encodedSecret = secret;
    
    return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${encodedSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  /**
   * Generate backup codes for TOTP
   */
  static generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      // Generate 8-digit backup code
      const code = randomBytes(4).readUInt32BE(0).toString().slice(-8).padStart(8, '0');
      codes.push(code);
    }
    
    return codes;
  }

  /**
   * Hash backup codes for secure storage
   */
  static hashBackupCodes(codes: string[]): string[] {
    return codes.map(code => {
      const hash = createHash('sha256');
      hash.update(code);
      return hash.digest('hex');
    });
  }

  /**
   * Verify backup code against hashed codes
   */
  static verifyBackupCode(code: string, hashedCodes: string[]): boolean {
    const hash = createHash('sha256');
    hash.update(code);
    const hashedInput = hash.digest('hex');
    
    return hashedCodes.some(hashedCode => this.constantTimeCompare(hashedInput, hashedCode));
  }

  /**
   * Remove used backup code from the list
   */
  static removeUsedBackupCode(code: string, hashedCodes: string[]): string[] {
    const hash = createHash('sha256');
    hash.update(code);
    const hashedInput = hash.digest('hex');
    
    return hashedCodes.filter(hashedCode => !this.constantTimeCompare(hashedInput, hashedCode));
  }

  /**
   * Base32 encode buffer
   */
  private static base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;
    
    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;
      
      while (bits >= 5) {
        result += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    
    if (bits > 0) {
      result += alphabet[(value << (5 - bits)) & 31];
    }
    
    return result;
  }

  /**
   * Base32 decode string to buffer
   */
  private static base32Decode(encoded: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanInput = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
    
    let bits = 0;
    let value = 0;
    const result: number[] = [];
    
    for (let i = 0; i < cleanInput.length; i++) {
      const index = alphabet.indexOf(cleanInput[i]);
      if (index === -1) continue;
      
      value = (value << 5) | index;
      bits += 5;
      
      if (bits >= 8) {
        result.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    
    return Buffer.from(result);
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private static constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }
}
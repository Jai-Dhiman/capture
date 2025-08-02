import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Bindings } from '../../types';

export interface PresignedUrlOptions {
  expiresIn?: number;
  contentType?: string;
  headers?: Record<string, string>;
}

export class R2PresignedUrlService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(env: Bindings) {
    // For R2, we need to use the S3-compatible API with AWS SDK
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: env.R2_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucketName = 'capture-images';
  }

  async createPresignedUrl(
    key: string,
    method: 'GET' | 'PUT',
    options: PresignedUrlOptions = {}
  ): Promise<string> {
    const { expiresIn = 3600, contentType, headers = {} } = options;

    let command: GetObjectCommand | PutObjectCommand;
    
    switch (method) {
      case 'GET':
        command = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        });
        break;
      case 'PUT':
        command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          ...(contentType && { ContentType: contentType }),
          ...(Object.keys(headers).length > 0 && { Metadata: headers }),
        });
        break;
      default:
        throw new Error(`Unsupported method: ${method}`);
    }

    return await getSignedUrl(this.s3Client, command, {
      expiresIn,
    });
  }
}

export function createR2PresignedUrlService(env: Bindings): R2PresignedUrlService {
  return new R2PresignedUrlService(env);
}
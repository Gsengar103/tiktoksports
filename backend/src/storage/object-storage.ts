import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Env } from "../config/env";

export const OBJECT_STORAGE = Symbol("OBJECT_STORAGE");

export interface ObjectStorage {
  presignPut(key: string, contentType: string): Promise<string>;
  presignGet(key: string): Promise<string>;
}

type StoredObject = { body: Buffer; contentType: string };

const memoryObjects = new Map<string, StoredObject>();

export function saveMemoryObject(key: string, body: Buffer, contentType: string): void {
  memoryObjects.set(key, { body, contentType });
}

export function readMemoryObject(key: string): StoredObject | undefined {
  return memoryObjects.get(key);
}

@Injectable()
export class MemoryObjectStorage implements ObjectStorage {
  constructor(private readonly origin: string) {}

  presignPut(key: string): Promise<string> {
    return Promise.resolve(`${this.origin}/dev/objects?key=${encodeURIComponent(key)}`);
  }

  presignGet(key: string): Promise<string> {
    return Promise.resolve(`${this.origin}/dev/objects?key=${encodeURIComponent(key)}`);
  }
}

@Injectable()
export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicEndpoint: string;
  private readonly internalEndpoint: string;

  constructor(config: ConfigService<Env, true>) {
    this.bucket = config.get("S3_BUCKET", { infer: true });
    this.publicEndpoint = config.get("S3_PUBLIC_ENDPOINT", { infer: true }) ?? "";
    this.internalEndpoint = config.get("S3_ENDPOINT", { infer: true }) ?? "";
    this.client = new S3Client({
      region: config.get("S3_REGION", { infer: true }),
      endpoint: this.internalEndpoint,
      forcePathStyle: config.get("S3_FORCE_PATH_STYLE", { infer: true }) ?? true,
      credentials: {
        accessKeyId: config.get("S3_ACCESS_KEY", { infer: true }) ?? "",
        secretAccessKey: config.get("S3_SECRET_KEY", { infer: true }) ?? "",
      },
    });
  }

  async presignPut(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    return this.publish(await getSignedUrl(this.client, command, { expiresIn: 60 * 15 }));
  }

  async presignGet(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return this.publish(await getSignedUrl(this.client, command, { expiresIn: 60 * 60 }));
  }

  private publish(signed: string): string {
    if (!this.publicEndpoint || this.publicEndpoint === this.internalEndpoint) return signed;
    const url = new URL(signed);
    const pub = new URL(this.publicEndpoint);
    url.protocol = pub.protocol;
    url.host = pub.host;
    return url.toString();
  }
}

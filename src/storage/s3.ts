import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../lib/config.js";

const client = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = config.S3_BUCKET;

export async function upload(
  key: string,
  buffer: Buffer,
  mime: string
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mime,
    })
  );
}

export async function getBuffer(key: string): Promise<Buffer> {
  const response = await client.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key })
  );
  const stream = response.Body;
  if (!stream) {
    throw new Error("Empty S3 response body");
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function presignedUrl(
  key: string,
  expirySeconds = 3600
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(client, command, { expiresIn: expirySeconds });
}

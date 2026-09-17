import {
  S3Client,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  requestHandler: new NodeHttpHandler({ httpsAgent: agent }),
});

const bucket = process.env.R2_BUCKET || 'caratsay-media';

try {
  const hb = await r2.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log('HEAD_BUCKET_OK', bucket, 'http', hb.$metadata.httpStatusCode);
} catch (e) {
  console.log('HEAD_BUCKET_FAIL', bucket, e.name, e.$metadata?.httpStatusCode, e.message);
}

try {
  const lo = await r2.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 5 }));
  console.log('LIST_OK', bucket, 'count', lo.KeyCount ?? 0, 'sample', (lo.Contents ?? []).map((o) => o.Key).slice(0, 5));
} catch (e) {
  console.log('LIST_FAIL', bucket, e.name, e.$metadata?.httpStatusCode, e.message);
}

const probeKey = '_migrate_probe_' + Date.now() + '.txt';
try {
  await r2.send(new PutObjectCommand({ Bucket: bucket, Key: probeKey, Body: 'probe', ContentType: 'text/plain' }));
  console.log('PUT_OK', bucket);
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: probeKey }));
  console.log('DELETE_OK (probe cleaned)');
} catch (e) {
  console.log('WRITE_FAIL', bucket, e.name, e.$metadata?.httpStatusCode, e.message);
}

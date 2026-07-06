require("dotenv").config();

const {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectTaggingCommand,
  PutObjectTaggingCommand,
} = require("@aws-sdk/client-s3");

const { Upload } = require("@aws-sdk/lib-storage");
const { NodeHttpHandler } = require("@smithy/node-http-handler");

function buildConfig(prefix) {
  const endpoint = buildEndpoint(prefix);
  const accessKeyId = getAccessKey(prefix);
  const secretAccessKey = getSecretKey(prefix);

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      `Missing credentials for ${prefix}. Provide either ${prefix}_ACCESS_KEY and ${prefix}_SECRET_KEY, or ${prefix}_ROOT_USER and ${prefix}_ROOT_PASSWORD`
    );
  }

  return {
    endpoint,
    region: process.env[`${prefix}_REGION`] || "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    maxAttempts: 3,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 10000,
      requestTimeout: 30000,
    }),
  };
}

function buildEndpoint(prefix) {
  // Try direct endpoint first (S3_ENDPOINT or OLD_ENDPOINT, NEW_ENDPOINT)
  const directEndpoint = process.env[`${prefix}_ENDPOINT`];
  if (directEndpoint && directEndpoint.includes("://")) {
    return directEndpoint;
  }

  // Try building from host + port + ssl
  const host = process.env[`${prefix}_ENDPOINT`] || process.env[`${prefix}_HOST`];
  if (host) {
    const port = process.env[`${prefix}_PORT`] || 9000;
    const useSSL = (process.env[`${prefix}_USE_SSL`] || "false").toLowerCase() === "true";
    const protocol = useSSL ? "https" : "http";
    return `${protocol}://${host}:${port}`;
  }

  throw new Error(
    `Missing endpoint for ${prefix}. Provide ${prefix}_ENDPOINT or ${prefix}_HOST`
  );
}

function getAccessKey(prefix) {
  // Try access key first
  if (process.env[`${prefix}_ACCESS_KEY`]) {
    return process.env[`${prefix}_ACCESS_KEY`];
  }

  // Fall back to root user (some MinIO setups use root user as access key)
  if (process.env[`${prefix}_ROOT_USER`]) {
    return process.env[`${prefix}_ROOT_USER`];
  }

  return null;
}

function getSecretKey(prefix) {
  // Try secret key first
  if (process.env[`${prefix}_SECRET_KEY`]) {
    return process.env[`${prefix}_SECRET_KEY`];
  }

  // Fall back to root password (some MinIO setups use root password as secret key)
  if (process.env[`${prefix}_ROOT_PASSWORD`]) {
    return process.env[`${prefix}_ROOT_PASSWORD`];
  }

  return null;
}

const OLD = new S3Client(buildConfig("OLD"));
const NEW = new S3Client(buildConfig("NEW"));

async function bucketExists(bucket) {
  try {
    await NEW.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}

async function ensureBucket(bucket) {
  if (!(await bucketExists(bucket))) {
    console.log(`Creating bucket ${bucket}`);
    await NEW.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

async function migrateObject(bucket, key) {
  console.log(`Copying ${bucket}/${key}`);

  const object = await OLD.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  const head = await OLD.send(
    new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  const upload = new Upload({
    client: NEW,
    params: {
      Bucket: bucket,
      Key: key,
      Body: object.Body,
      ContentType: head.ContentType,
      ContentEncoding: head.ContentEncoding,
      ContentDisposition: head.ContentDisposition,
      CacheControl: head.CacheControl,
      Metadata: head.Metadata,
    },
  });

  await upload.done();

  // Copy tags if present
  try {
    const tags = await OLD.send(
      new GetObjectTaggingCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    if (tags.TagSet.length) {
      await NEW.send(
        new PutObjectTaggingCommand({
          Bucket: bucket,
          Key: key,
          Tagging: {
            TagSet: tags.TagSet,
          },
        })
      );
    }
  } catch (e) {
    // ignore if object has no tags
  }
}

async function migrateBucket(bucket) {
  console.log(`\nMigrating bucket: ${bucket}`);

  await ensureBucket(bucket);

  let token;

  do {
    const list = await OLD.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: token,
      })
    );

    for (const obj of list.Contents || []) {
      await migrateObject(bucket, obj.Key);
    }

    token = list.NextContinuationToken;
  } while (token);

  console.log(`Finished bucket ${bucket}`);
}

async function validateConnection(client, name, endpoint) {
  try {
    console.log(`  Connecting to ${name}: ${endpoint}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    await client.send(new ListBucketsCommand({}), {
      abortSignal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log(`✓ ${name} connection OK`);
    return true;
  } catch (error) {
    console.error(`✗ ${name} connection failed: ${error.message}`);
    return false;
  }
}

async function validateConnections() {
  console.log("Validating connections...\n");

  const oldEndpoint = buildEndpoint("OLD");
  const newEndpoint = buildEndpoint("NEW");

  const oldOk = await validateConnection(OLD, "OLD MinIO", oldEndpoint);
  const newOk = await validateConnection(NEW, "NEW MinIO", newEndpoint);

  if (!oldOk || !newOk) {
    console.error("\n✗ Connection validation failed. Aborting.");
    process.exit(1);
  }

  console.log("\n✓ All connections validated. Starting migration...\n");
}

async function migrateAll() {
  await validateConnections();

  const buckets = await OLD.send(new ListBucketsCommand({}));

  for (const bucket of buckets.Buckets) {
    await migrateBucket(bucket.Name);
  }

  console.log("\nMigration complete.");
}

migrateAll().catch(console.error);
import { z } from 'zod'

const dbConnectionRefine = (
  data: {
    DATABASE_URL?: string
    INSTANCE_CONNECTION_NAME?: string
    DB_USER?: string
    DB_PASS?: string
    DB_NAME?: string
  },
  ctx: z.RefinementCtx
) => {
  const hasUrl = Boolean(data.DATABASE_URL?.trim())
  const hasCloudSql =
    Boolean(data.INSTANCE_CONNECTION_NAME?.trim()) &&
    Boolean(data.DB_USER?.trim()) &&
    Boolean(data.DB_PASS?.trim()) &&
    Boolean(data.DB_NAME?.trim())
  if (!hasUrl && !hasCloudSql) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Set DATABASE_URL (local) or INSTANCE_CONNECTION_NAME + DB_USER + DB_PASS + DB_NAME (Cloud Run)',
    })
  }
}

const dbEnvFields = {
  /** Local dev — full connection string */
  DATABASE_URL: z.string().min(1).optional(),
  /** Cloud Run — built into a URL by @severino/db pool-config */
  INSTANCE_CONNECTION_NAME: z.string().min(1).optional(),
  DB_USER: z.string().min(1).optional(),
  DB_PASS: z.string().min(1).optional(),
  DB_NAME: z.string().min(1).optional(),
  DATABASE_SSL: z.enum(['true', 'false']).optional(),
} as const

const IngestEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(8080),
    SERVICE_ROLE: z.literal('ingest'),
    GCP_PROJECT_ID: z.string().min(1).optional(),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
    WHATSAPP_WABA_ID: z.string().optional(),
    ...dbEnvFields,
    WHATSAPP_APP_SECRET: z.string().min(1),
    WHATSAPP_VERIFY_TOKEN: z.string().min(1),
    PUBSUB_TOPIC: z.string().min(1),
    PUBLISHER_MODE: z.enum(['pubsub', 'direct']).default('pubsub'),
    WORKER_URL: z.string().url().optional(),
  })
  .superRefine(dbConnectionRefine)

const WorkerEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(8080),
    SERVICE_ROLE: z.literal('worker'),
    GCP_PROJECT_ID: z.string().min(1).optional(),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
    WHATSAPP_WABA_ID: z.string().optional(),
    ...dbEnvFields,
    PUBSUB_PUSH_AUDIENCE: z.string().url().optional(),
  })
  .superRefine(dbConnectionRefine)

function parseEnv() {
  const role = process.env.SERVICE_ROLE ?? 'ingest'
  if (role === 'worker') {
    return WorkerEnvSchema.parse(process.env)
  }
  return IngestEnvSchema.parse(process.env)
}

export const env = parseEnv()
export type Env = typeof env
export type IngestEnv = z.infer<typeof IngestEnvSchema>
export type WorkerEnv = z.infer<typeof WorkerEnvSchema>

export function isIngestEnv(e: Env): e is IngestEnv {
  return e.SERVICE_ROLE === 'ingest'
}

export function isWorkerEnv(e: Env): e is WorkerEnv {
  return e.SERVICE_ROLE === 'worker'
}

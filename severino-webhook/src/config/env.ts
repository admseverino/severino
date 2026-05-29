import { z } from 'zod'

const BaseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  SERVICE_ROLE: z.enum(['ingest', 'worker']).default('ingest'),
  GCP_PROJECT_ID: z.string().min(1).optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_WABA_ID: z.string().optional(),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(['true', 'false']).optional(),
})

const IngestEnvSchema = BaseEnvSchema.extend({
  SERVICE_ROLE: z.literal('ingest'),
  WHATSAPP_APP_SECRET: z.string().min(1),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  PUBSUB_TOPIC: z.string().min(1),
  PUBLISHER_MODE: z.enum(['pubsub', 'direct']).default('pubsub'),
  WORKER_URL: z.string().url().optional(),
})

const WorkerEnvSchema = BaseEnvSchema.extend({
  SERVICE_ROLE: z.literal('worker'),
  PUBSUB_PUSH_AUDIENCE: z.string().url().optional(),
})

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

# Severino GCP infrastructure (gcloud)

Provisioned in project **`severino-project`** (`261525847382`), region **`us-east4`**.

Naming convention: flat `severino-<component>` (no env suffix).

## Resource map

| Resource | Name / value |
|---|---|
| VPC | `severino-vpc` |
| Subnet | `severino-subnet` (`10.0.0.0/24`, `us-east4`) |
| Peering range | `severino-vpc-peering-range` |
| Cloud SQL instance | `severino-sql` (PostgreSQL 16, `db-f1-micro`, enterprise edition, private IP only) |
| Connection name | `severino-project:us-east4:severino-sql` |
| Database | `severino-service` |
| DB user | `postgres` (password in Secret Manager `severino-db-pass`) |
| Artifact Registry | `us-east4-docker.pkg.dev/severino-project/severino` |
| Service account | `severino-sa@severino-project.iam.gserviceaccount.com` — Cloud Build, Cloud Run runtime, Pub/Sub OIDC |
| Cloud Build worker pool | `severino-build` (`us-east4`, optional — only for regional `gcloud builds submit --region=us-east4`) |

## Cloud Build triggers

| Trigger | Tag pattern | Config |
|---|---|---|
| `severino-database-deploy` | `database-X.Y.Z` | [`cloudbuild.yaml`](../../cloudbuild.yaml) |
| `severino-webhook-deploy` | `webhook-X.Y.Z` | [`severino-webhook/cloudbuild.yaml`](../../severino-webhook/cloudbuild.yaml) |

Both triggers run as `severino-sa@` (global triggers — 1st-gen GitHub connection).

**Important:** Global triggers cannot use a regional private worker pool. Database migrations reach Cloud SQL via the Auth Proxy over the instance **public IP** (IAM auth, no authorized networks). Cloud Run continues to use the **private IP** connector at runtime.

## Deploy workflow

```bash
# 1. Push code changes, then run migrations
git tag database-1.0.0 && git push origin database-1.0.0

# 2. Deploy webhook (ingest + worker)
git tag webhook-1.0.0 && git push origin webhook-1.0.0
```

Migrations run **only** on the database tag. The webhook pipeline builds the image and deploys Cloud Run ingest + worker without migrating.

## Before first webhook deploy

1. **WhatsApp secrets** — replace placeholders in Secret Manager:

   ```bash
   echo -n 'YOUR_APP_SECRET' | gcloud secrets versions add whatsapp-app-secret \
     --project=severino-project --data-file=-
   echo -n 'YOUR_VERIFY_TOKEN' | gcloud secrets versions add whatsapp-verify-token \
     --project=severino-project --data-file=-
   ```

2. **Meta App Dashboard** — set callback URL to the ingest Cloud Run URL (`/webhook`).

The webhook pipeline grants `severino-sa` → `run.invoker` on the worker and wires Pub/Sub OIDC automatically.

## Re-provision from scratch

These commands recreate the stack. Replace `DB_PASS` with a strong password and store it in Secret Manager.

### 1. Enable APIs

```bash
gcloud services enable \
  compute.googleapis.com \
  sqladmin.googleapis.com \
  servicenetworking.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  pubsub.googleapis.com \
  --project=severino-project
```

### 2. VPC + private service access

```bash
gcloud compute networks create severino-vpc \
  --project=severino-project --subnet-mode=custom

gcloud compute networks subnets create severino-subnet \
  --project=severino-project --network=severino-vpc \
  --region=us-east4 --range=10.0.0.0/24

gcloud compute addresses create severino-vpc-peering-range \
  --project=severino-project --global \
  --purpose=VPC_PEERING --prefix-length=16 --network=severino-vpc

gcloud services vpc-peerings connect \
  --project=severino-project \
  --service=servicenetworking.googleapis.com \
  --ranges=severino-vpc-peering-range \
  --network=severino-vpc
```

### 3. Cloud SQL

> **Note:** PostgreSQL 16 requires `--edition=enterprise` for the `db-f1-micro` tier.

```bash
gcloud sql instances create severino-sql \
  --project=severino-project \
  --database-version=POSTGRES_16 \
  --edition=enterprise \
  --tier=db-f1-micro \
  --region=us-east4 \
  --network=projects/severino-project/global/networks/severino-vpc \
  --no-assign-ip \
  --storage-type=SSD --storage-size=10GB --storage-auto-increase \
  --backup-start-time=03:00 \
  --database-flags=max_connections=100

gcloud sql databases create severino-service \
  --instance=severino-sql --project=severino-project

gcloud sql users create postgres \
  --instance=severino-sql --project=severino-project \
  --password='DB_PASS'
```

### 4. Artifact Registry

```bash
gcloud artifacts repositories create severino \
  --project=severino-project \
  --repository-format=docker \
  --location=us-east4 \
  --description="Severino container images"
```

### 5. Service account + IAM

Single SA for Cloud Build, Cloud Run runtime, and Pub/Sub OIDC push.

```bash
PROJECT=severino-project
PROJECT_NUM=261525847382
SA=severino-sa@${PROJECT}.iam.gserviceaccount.com
CB_AGENT="service-${PROJECT_NUM}@gcp-sa-cloudbuild.iam.gserviceaccount.com"

gcloud iam service-accounts create severino-sa \
  --project=$PROJECT --display-name="severino-sa"

for ROLE in roles/run.admin roles/iam.serviceAccountUser roles/cloudsql.client \
            roles/artifactregistry.writer roles/secretmanager.secretAccessor roles/pubsub.publisher; do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:${SA}" --role="$ROLE"
done

for MEMBER in "$SA" "$CB_AGENT"; do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:${MEMBER}" --role=roles/cloudbuild.workerPoolUser
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:${MEMBER}" --role=roles/compute.networkUser
done

gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:${SA}" --role=roles/logging.logWriter

# Cloud Build service agent must impersonate severino-sa on trigger runs
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --project=$PROJECT \
  --member="serviceAccount:${CB_AGENT}" \
  --role=roles/iam.serviceAccountUser

gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --project=$PROJECT \
  --member="serviceAccount:${CB_AGENT}" \
  --role=roles/iam.serviceAccountTokenCreator

# Cloud Run deploy attaches severino-sa as runtime identity (same as build SA)
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --project=$PROJECT \
  --member="serviceAccount:${SA}" \
  --role=roles/iam.serviceAccountUser
```

### 5b. Cloud SQL public IP (for Cloud Build migrations)

Global GitHub triggers run on default Cloud Build workers (no VPC). Enable a public IP so the Auth Proxy can connect during `database-X.Y.Z` deploys. No authorized networks are needed — access is IAM-only via the proxy.

```bash
gcloud sql instances patch severino-sql \
  --project=severino-project --assign-ip
```

Cloud Run services keep using `--add-cloudsql-instances` (private connector, private IP `10.132.0.3`).

### 5c. Private worker pool (optional, regional builds only)

Only needed if you move to **regional** triggers with a 2nd-gen GitHub connection (`gcloud builds connections`). Not compatible with the current global 1st-gen triggers.

```bash
gcloud compute addresses create severino-build-pool-range \
  --project=severino-project --global --purpose=VPC_PEERING \
  --prefix-length=24 --network=severino-vpc

gcloud services vpc-peerings update \
  --project=severino-project --network=severino-vpc \
  --service=servicenetworking.googleapis.com \
  --ranges=severino-vpc-peering-range,severino-build-pool-range --force

gcloud builds worker-pools create severino-build \
  --project=severino-project --region=us-east4 \
  --peered-network=projects/severino-project/global/networks/severino-vpc \
  --peered-network-ip-range=/28 \
  --worker-machine-type=e2-medium \
  --public-egress
```

### 6. Secrets

```bash
echo -n 'DB_PASS' | gcloud secrets create severino-db-pass \
  --project=severino-project --data-file=-

echo -n 'REPLACE' | gcloud secrets create whatsapp-app-secret \
  --project=severino-project --data-file=-

echo -n 'REPLACE' | gcloud secrets create whatsapp-verify-token \
  --project=severino-project --data-file=-
```

### 7. Cloud Build triggers

```bash
SA_RESOURCE="projects/severino-project/serviceAccounts/severino-sa@severino-project.iam.gserviceaccount.com"

gcloud builds triggers create github \
  --project=severino-project \
  --name=severino-database-deploy \
  --repo-name=severino --repo-owner=admseverino \
  --tag-pattern='^database-\d+\.\d+\.\d+$' \
  --build-config=cloudbuild.yaml \
  --service-account="$SA_RESOURCE" \
  --substitutions=_INSTANCE_CONNECTION_NAME=severino-project:us-east4:severino-sql,\
_DB_USER=postgres,_DB_PASS=DB_PASS,_DB_NAME=severino-service

gcloud builds triggers create github \
  --project=severino-project \
  --name=severino-webhook-deploy \
  --repo-name=severino --repo-owner=admseverino \
  --tag-pattern='^webhook-\d+\.\d+\.\d+$' \
  --build-config=severino-webhook/cloudbuild.yaml \
  --service-account="$SA_RESOURCE" \
  --substitutions=_REGION=us-east4,_AR_REPO=severino,\
_INSTANCE_CONNECTION_NAME=severino-project:us-east4:severino-sql,\
_DB_USER=postgres,_DB_PASS=DB_PASS,_DB_NAME=severino-service,\
_SECRET_WHATSAPP_APP_SECRET=whatsapp-app-secret,\
_SECRET_WHATSAPP_VERIFY_TOKEN=whatsapp-verify-token
```

## Cost and upgrade path

| Resource | Current | Upgrade |
|---|---|---|
| Cloud SQL | `db-f1-micro`, zonal, 10 GB SSD | `db-g1-small` → `db-custom-*` → HA regional |
| Cloud Run ingest | `min-instances 0` | Raise to `1` if cold starts hurt webhook latency |
| Cloud Run worker | max 10 × pool 5 = 50 connections | Raise tier or lower max instances |

Monitor Cloud SQL CPU/memory in Console. Webhook worker capacity invariant:

```
worker.max_instances × db.pool.max  <  cloud_sql.max_connections − headroom
```

## MVP compromises (phase-2 backlog)

- DB password passed as Cloud Build trigger substitution `_DB_PASS` (also stored in Secret Manager `severino-db-pass`). Wire Secret Manager into triggers later.
- Single shared SA (`severino-sa`) for build + runtime — split per service when moving to prod.
- Cloud SQL deletion protection not enabled yet.
- Cloud Scheduler reconcile job (`whatsapp-reconcile`) not provisioned.

## Legacy service accounts

These were replaced by `severino-sa` and can be deleted once confirmed unused:

- `severino-cloudbuild@`
- `webhook-ingest@`
- `webhook-worker@`
- `pubsub-pusher@`

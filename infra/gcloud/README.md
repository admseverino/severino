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
| Cloud Build deployer SA | `severino-cloudbuild@severino-project.iam.gserviceaccount.com` |
| Webhook ingest SA | `webhook-ingest@severino-project.iam.gserviceaccount.com` |
| Webhook worker SA | `webhook-worker@severino-project.iam.gserviceaccount.com` |
| Pub/Sub pusher SA | `pubsub-pusher@severino-project.iam.gserviceaccount.com` |

## Cloud Build triggers

| Trigger | Tag pattern | Config |
|---|---|---|
| `severino-database-deploy` | `database-X.Y.Z` | [`cloudbuild.yaml`](../../cloudbuild.yaml) |
| `severino-webhook-ingest-deploy` | `webhook-X.Y.Z` | [`severino-webhook/cloudbuild.yaml`](../../severino-webhook/cloudbuild.yaml) |

Both triggers use service account `severino-cloudbuild@`.

## Deploy workflow

```bash
# 1. Push code changes, then run migrations
git tag database-1.0.0 && git push origin database-1.0.0

# 2. After database build succeeds, deploy webhook
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

2. **Pub/Sub → worker IAM** — after the first webhook deploy creates `severino-webhook-worker`:

   ```bash
   gcloud run services add-iam-policy-binding severino-webhook-worker \
     --project=severino-project --region=us-east4 \
     --member="serviceAccount:pubsub-pusher@severino-project.iam.gserviceaccount.com" \
     --role=roles/run.invoker
   ```

3. **Meta App Dashboard** — set callback URL to the ingest Cloud Run URL (`/webhook`).

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

### 5. Service accounts + IAM

```bash
PROJECT=severino-project
PROJECT_NUM=261525847382
CB_SA="${PROJECT_NUM}@cloudbuild.gserviceaccount.com"
DEPLOYER=severino-cloudbuild@${PROJECT}.iam.gserviceaccount.com

for SA in severino-cloudbuild webhook-ingest webhook-worker pubsub-pusher; do
  gcloud iam service-accounts create "$SA" --project=$PROJECT --display-name="$SA"
done

for ROLE in roles/run.admin roles/iam.serviceAccountUser roles/cloudsql.client \
            roles/artifactregistry.writer roles/secretmanager.secretAccessor; do
  for MEMBER in "$DEPLOYER" "$CB_SA"; do
    gcloud projects add-iam-policy-binding $PROJECT \
      --member="serviceAccount:${MEMBER}" --role="$ROLE"
  done
done

gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:webhook-ingest@${PROJECT}.iam.gserviceaccount.com" \
  --role=roles/pubsub.publisher

gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:webhook-worker@${PROJECT}.iam.gserviceaccount.com" \
  --role=roles/cloudsql.client

gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:webhook-ingest@${PROJECT}.iam.gserviceaccount.com" \
  --role=roles/cloudsql.client
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
DEPLOYER_SA="projects/severino-project/serviceAccounts/severino-cloudbuild@severino-project.iam.gserviceaccount.com"

gcloud builds triggers create github \
  --project=severino-project \
  --name=severino-database-deploy \
  --repo-name=severino --repo-owner=admseverino \
  --tag-pattern='^database-\d+\.\d+\.\d+$' \
  --build-config=cloudbuild.yaml \
  --service-account="$DEPLOYER_SA" \
  --substitutions=_INSTANCE_CONNECTION_NAME=severino-project:us-east4:severino-sql,\
_DB_USER=postgres,_DB_PASS=DB_PASS,_DB_NAME=severino-service

gcloud builds triggers create github \
  --project=severino-project \
  --name=severino-webhook-ingest-deploy \
  --repo-name=severino --repo-owner=admseverino \
  --tag-pattern='^webhook-\d+\.\d+\.\d+$' \
  --build-config=severino-webhook/cloudbuild.yaml \
  --service-account="$DEPLOYER_SA" \
  --substitutions=_REGION=us-east4,_AR_REPO=severino,\
_INSTANCE_CONNECTION_NAME=severino-project:us-east4:severino-sql,\
_DB_USER=postgres,_DB_PASS=DB_PASS,_DB_NAME=severino-service,\
_INGEST_SA=webhook-ingest@severino-project.iam.gserviceaccount.com,\
_WORKER_SA=webhook-worker@severino-project.iam.gserviceaccount.com,\
_PUBSUB_PUSHER_SA=pubsub-pusher@severino-project.iam.gserviceaccount.com,\
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
- Cloud SQL deletion protection not enabled yet.
- Cloud Scheduler reconcile job (`whatsapp-reconcile`) not provisioned.

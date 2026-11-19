import { sql } from "drizzle-orm";
import {
  customType, index, integer, jsonb, pgEnum, pgTable, real, text, timestamp, uniqueIndex, uuid, vector,
} from "drizzle-orm/pg-core";
import { PROCESSING_STATES } from "../lib/constants";
import { ROLES } from "../lib/rbac";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const pk = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("role", ROLES);
export const processingStateEnum = pgEnum("processing_state", PROCESSING_STATES);
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system"]);
export const reviewStatusEnum = pgEnum("review_status", ["pending", "approved", "edited", "rejected"]);

export const organizations = pgTable("organizations", {
  id: pk(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // Clerk org id or user id
  status: text("status").notNull().default("active"),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: pk(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    role: roleEnum("role").notNull().default("reader"),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("memberships_org_user_uq").on(t.organizationId, t.clerkUserId)],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: pk(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    retentionDays: integer("retention_days"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("workspaces_org_uq").on(t.organizationId)],
);

export const collections = pgTable("collections", {
  id: pk(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: createdAt(),
});

export const documents = pgTable(
  "documents",
  {
    id: pk(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id").references(() => collections.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    docType: text("doc_type").notNull().default("Other"),
    status: processingStateEnum("status").notNull().default("uploaded"),
    currentVersionId: uuid("current_version_id"),
    createdBy: text("created_by").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("documents_workspace_status_idx").on(t.workspaceId, t.status),
    index("documents_collection_idx").on(t.collectionId),
  ],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: pk(),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    objectKey: text("object_key").notNull(),
    checksum: text("checksum").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    pageCount: integer("page_count"),
    createdBy: text("created_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("document_versions_doc_ver_uq").on(t.documentId, t.versionNumber)],
);

export const processingJobs = pgTable(
  "processing_jobs",
  {
    id: pk(),
    versionId: uuid("version_id").notNull().references(() => documentVersions.id, { onDelete: "cascade" }),
    jobKey: text("job_key").notNull().unique(), // version + pipeline version + operation (idempotency)
    state: processingStateEnum("state").notNull().default("queued"),
    processorVersion: text("processor_version").notNull(),
    attempts: integer("attempts").notNull().default(0),
    errorCode: text("error_code"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("processing_jobs_state_idx").on(t.state, t.nextAttemptAt)],
);

export const processingSteps = pgTable("processing_steps", {
  id: pk(),
  jobId: uuid("job_id").notNull().references(() => processingJobs.id, { onDelete: "cascade" }),
  stepName: text("step_name").notNull(),
  status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  metrics: jsonb("metrics").$type<Record<string, unknown>>(),
});

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: pk(),
    versionId: uuid("version_id").notNull().references(() => documentVersions.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    page: integer("page").notNull().default(1),
    section: text("section"),
    charStart: integer("char_start").notNull().default(0),
    charEnd: integer("char_end").notNull().default(0),
    tokenCount: integer("token_count").notNull().default(0),
    search: tsvector("search").generatedAlwaysAs(sql`to_tsvector('english', content)`),
  },
  (t) => [
    uniqueIndex("document_chunks_version_idx_uq").on(t.versionId, t.chunkIndex),
    index("document_chunks_search_gin").using("gin", t.search),
  ],
);

export const EMBEDDING_DIMENSIONS = 1536;

export const documentEmbeddings = pgTable(
  "document_embeddings",
  {
    id: pk(),
    chunkId: uuid("chunk_id").notNull().references(() => documentChunks.id, { onDelete: "cascade" }),
    modelId: text("model_id").notNull(),
    dimensions: integer("dimensions").notNull().default(EMBEDDING_DIMENSIONS),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  },
  (t) => [
    uniqueIndex("document_embeddings_chunk_model_uq").on(t.chunkId, t.modelId),
    index("document_embeddings_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const documentAcl = pgTable(
  "document_acl",
  {
    id: pk(),
    resourceType: text("resource_type").notNull(), // document | collection
    resourceId: uuid("resource_id").notNull(),
    principalType: text("principal_type").notNull(), // user | role
    principalId: text("principal_id").notNull(),
    permission: text("permission").notNull(),
    effect: text("effect").notNull().default("allow"), // allow | deny (deny wins)
  },
  (t) => [index("document_acl_resource_idx").on(t.resourceType, t.resourceId)],
);

export const conversations = pgTable("conversations", {
  id: pk(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  title: text("title").notNull().default("New conversation"),
  createdAt: createdAt(),
});

export const messages = pgTable("messages", {
  id: pk(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  modelId: text("model_id"),
  promptVersion: text("prompt_version"),
  insufficientEvidence: integer("insufficient_evidence").notNull().default(0),
  createdAt: createdAt(),
});

export const messageCitations = pgTable("message_citations", {
  id: pk(),
  messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  chunkId: uuid("chunk_id").notNull().references(() => documentChunks.id, { onDelete: "cascade" }),
  versionId: uuid("version_id").notNull(),
  pageNumber: integer("page_number").notNull(),
  quoteHash: text("quote_hash").notNull(),
});

export const extractionSchemas = pgTable("extraction_schemas", {
  id: pk(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  jsonSchema: jsonb("json_schema").$type<Record<string, unknown>>().notNull(),
  version: integer("version").notNull().default(1),
});

export const extractionRuns = pgTable("extraction_runs", {
  id: pk(),
  versionId: uuid("version_id").notNull().references(() => documentVersions.id, { onDelete: "cascade" }),
  schemaId: uuid("schema_id").references(() => extractionSchemas.id),
  status: text("status").notNull().default("pending"),
  modelId: text("model_id"),
  createdAt: createdAt(),
});

export const extractedFields = pgTable("extracted_fields", {
  id: pk(),
  runId: uuid("run_id").notNull().references(() => extractionRuns.id, { onDelete: "cascade" }),
  fieldPath: text("field_path").notNull(),
  valueJson: jsonb("value_json").notNull(),
  confidence: real("confidence").notNull(),
  sourceChunkId: uuid("source_chunk_id").references(() => documentChunks.id),
  reviewStatus: reviewStatusEnum("review_status").notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: pk(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_org_created_idx").on(t.organizationId, t.createdAt)],
);

export const usageEvents = pgTable("usage_events", {
  id: pk(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

export const outboxEvents = pgTable("outbox_events", {
  id: pk(),
  eventType: text("event_type").notNull(),
  aggregateId: text("aggregate_id").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** Uploaded file bytes. Keeps the app deployable anywhere with only Postgres; swap for S3/R2 by changing lib/storage.ts. */
export const fileObjects = pgTable("file_objects", {
  key: text("key").primaryKey(),
  data: bytea("data").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: createdAt(),
});

/** Editable rich-text documents (the Ajaia-style editor). Separate from uploaded files, which stay immutable. */
export const shareRoleEnum = pgEnum("share_role", ["viewer", "editor"]);

export const editorDocuments = pgTable(
  "editor_documents",
  {
    id: pk(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull().default("Untitled document"),
    /** Sanitized HTML. Sanitization runs server-side on every save. */
    contentHtml: text("content_html").notNull().default(""),
    /** Bumped on every save; clients send the version they loaded so stale saves are rejected. */
    revision: integer("revision").notNull().default(1),
    updatedBy: text("updated_by").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("editor_documents_owner_idx").on(t.ownerId, t.updatedAt), index("editor_documents_ws_idx").on(t.workspaceId)],
);

export const editorShares = pgTable(
  "editor_shares",
  {
    id: pk(),
    documentId: uuid("document_id").notNull().references(() => editorDocuments.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(), // Clerk user id of the person it is shared with
    email: text("email").notNull(),
    displayName: text("display_name").notNull().default(""),
    role: shareRoleEnum("role").notNull().default("viewer"),
    sharedBy: text("shared_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("editor_shares_doc_user_uq").on(t.documentId, t.userId), index("editor_shares_user_idx").on(t.userId)],
);

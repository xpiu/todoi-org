import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import type { DirectoryCopy, FilterToggle } from '@todoi/shared';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/** Optimistic concurrency: every editable row carries a counter a write must name. */
const version = { version: integer('version').notNull().default(1) };

export const directories = pgTable(
  'directories',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    kind: text('kind', { enum: ['oss', 'commercial'] }).notNull(),
    path: text('path').notNull().unique(),
    nounSingular: text('noun_singular').notNull(),
    nounPlural: text('noun_plural').notNull(),
    compiledOn: date('compiled_on').notNull(),
    modifiedOn: date('modified_on').notNull(),
    csvFile: text('csv_file').notNull().unique(),
    toggles: jsonb('toggles').$type<FilterToggle[]>().notNull(),
    copy: jsonb('copy').$type<DirectoryCopy>().notNull(),
    ...version,
    ...timestamps,
  },
  (t) => [check('directories_kind', sql`${t.kind} in ('oss', 'commercial')`)],
);

export const criteria = pgTable(
  'criteria',
  {
    id: serial('id').primaryKey(),
    directoryId: integer('directory_id')
      .notNull()
      .references(() => directories.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    key: text('key').notNull(),
    name: text('name').notNull(),
    head: text('head').notNull(),
    sr: text('sr').notNull(),
    tip: text('tip').notNull(),
    text: text('text').notNull(),
    csv: text('csv').notNull(),
  },
  (t) => [unique().on(t.directoryId, t.key), unique().on(t.directoryId, t.position)],
);

export const capabilities = pgTable(
  'capabilities',
  {
    id: serial('id').primaryKey(),
    directoryId: integer('directory_id')
      .notNull()
      .references(() => directories.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    key: text('key').notNull(),
    label: text('label').notNull(),
    tip: text('tip').notNull(),
    sr: text('sr').notNull(),
    csv: text('csv').notNull(),
  },
  (t) => [unique().on(t.directoryId, t.key), unique().on(t.directoryId, t.position)],
);

/** Licensing models (open source) or audiences (commercial). */
export const segments = pgTable(
  'segments',
  {
    id: serial('id').primaryKey(),
    directoryId: integer('directory_id')
      .notNull()
      .references(() => directories.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    key: text('key').notNull(),
    label: text('label').notNull(),
    chip: text('chip'),
    chipAria: text('chip_aria'),
    filter: text('filter').notNull(),
    tagClass: text('tag_class').notNull(),
    icon: text('icon').notNull(),
    tip: text('tip').notNull(),
    definition: text('definition'),
    audience: text('audience'),
    csvLabel: text('csv_label').notNull(),
  },
  (t) => [unique().on(t.directoryId, t.key), unique().on(t.directoryId, t.position)],
);

export const records = pgTable(
  'records',
  {
    id: serial('id').primaryKey(),
    directoryId: integer('directory_id')
      .notNull()
      .references(() => directories.id, { onDelete: 'cascade' }),
    segmentId: integer('segment_id')
      .notNull()
      .references(() => segments.id),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    url: text('url').notNull(),
    icon: text('icon').notNull(),
    blurb: text('blurb').notNull(),
    /** The line under the tag: short licence or vendor name. */
    modelSub: text('model_sub').notNull(),
    summary: text('summary').array().notNull(),
    summaryDate: date('summary_date').notNull(),
    year: smallint('year').notNull(),
    band: smallint('band').notNull(),
    bandEvidence: text('band_evidence').notNull(),
    integrationsLabel: text('integrations_label').notNull(),
    integrations: integer('integrations').notNull(),
    integrationNotes: text('integration_notes').notNull(),
    calendarSync: text('calendar_sync').notNull(),
    dataOut: text('data_out').notNull(),
    caveat: text('caveat').notNull(),
    confidence: text('confidence', { enum: ['High', 'Medium-high', 'Medium'] }).notNull(),
    ...version,
    ...timestamps,
  },
  (t) => [
    unique().on(t.directoryId, t.slug),
    check('records_band', sql`${t.band} between 1 and 5`),
    check('records_confidence', sql`${t.confidence} in ('High', 'Medium-high', 'Medium')`),
    check('records_slug', sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    index('records_directory').on(t.directoryId),
  ],
);

export const ossDetails = pgTable(
  'oss_details',
  {
    recordId: integer('record_id')
      .primaryKey()
      .references(() => records.id, { onDelete: 'cascade' }),
    licence: text('licence').notNull(),
    modelNote: text('model_note').notNull(),
    repository: text('repository').notNull(),
    repositoryUrl: text('repository_url').notNull(),
    stars: integer('stars').notNull(),
    starsNote: text('stars_note'),
    deployment: text('deployment').notNull(),
    stack: text('stack').notNull(),
    hostedOption: text('hosted_option').notNull(),
    /** The record's own line on its partial or missing capabilities: editorial, sanitised inline HTML. */
    capabilityNotes: text('capability_notes'),
  },
  (t) => [check('oss_details_stars', sql`${t.stars} >= 0`)],
);

export const commercialDetails = pgTable(
  'commercial_details',
  {
    recordId: integer('record_id')
      .primaryKey()
      .references(() => records.id, { onDelete: 'cascade' }),
    vendor: text('vendor').notNull(),
    yearNote: text('year_note'),
    /** USD per user per month, billed annually. Null: sold by quote. */
    price: numeric('price', { precision: 8, scale: 2, mode: 'number' }),
    priceLabel: text('price_label').notNull(),
    /** The price as the vendor publishes it (a flat or non-dollar price), as the dataset records it. */
    listPrice: numeric('list_price', { precision: 10, scale: 2, mode: 'number' }),
    listPriceLabel: text('list_price_label').notNull(),
    /** The CSV's Price_Note. */
    priceNote: text('price_note').notNull(),
    /** The dagger on the price cell, when the price needs qualifying. */
    priceDagger: text('price_dagger'),
    pricePublished: text('price_published'),
    freePlan: boolean('free_plan').notNull(),
    freePlanNote: text('free_plan_note').notNull(),
    plans: text('plans').notNull(),
    hosting: text('hosting').notNull(),
    security: text('security').notNull(),
    platforms: text('platforms').notNull(),
    ai: text('ai').notNull(),
  },
  (t) => [check('commercial_details_price', sql`${t.price} is null or ${t.price} >= 0`)],
);

export const recordScores = pgTable(
  'record_scores',
  {
    recordId: integer('record_id')
      .notNull()
      .references(() => records.id, { onDelete: 'cascade' }),
    criterionId: integer('criterion_id')
      .notNull()
      .references(() => criteria.id, { onDelete: 'cascade' }),
    score: numeric('score', { precision: 2, scale: 1, mode: 'number' }).notNull(),
    review: text('review').notNull(),
    ...version,
    updatedAt: timestamps.updatedAt,
  },
  (t) => [
    primaryKey({ columns: [t.recordId, t.criterionId] }),
    check('record_scores_range', sql`${t.score} between 1 and 5`),
  ],
);

export const recordCapabilities = pgTable(
  'record_capabilities',
  {
    recordId: integer('record_id')
      .notNull()
      .references(() => records.id, { onDelete: 'cascade' }),
    capabilityId: integer('capability_id')
      .notNull()
      .references(() => capabilities.id, { onDelete: 'cascade' }),
    /** 0 none, 1 partial, 2 native */
    level: smallint('level').notNull(),
    note: text('note'),
    ...version,
    updatedAt: timestamps.updatedAt,
  },
  (t) => [
    primaryKey({ columns: [t.recordId, t.capabilityId] }),
    check('record_capabilities_level', sql`${t.level} between 0 and 2`),
  ],
);

export const recordSources = pgTable(
  'record_sources',
  {
    recordId: integer('record_id')
      .notNull()
      .references(() => records.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    url: text('url').notNull(),
    /** The link text as published: usually the address without its scheme. */
    label: text('label').notNull(),
  },
  (t) => [primaryKey({ columns: [t.recordId, t.position] })],
);

export const faqs = pgTable(
  'faqs',
  {
    id: serial('id').primaryKey(),
    directoryId: integer('directory_id')
      .notNull()
      .references(() => directories.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    question: text('question').notNull(),
    /** Sanitised inline HTML. */
    answer: text('answer').notNull(),
    ...version,
    updatedAt: timestamps.updatedAt,
  },
  (t) => [unique().on(t.directoryId, t.position)],
);

export const routes = pgTable(
  'routes',
  {
    id: serial('id').primaryKey(),
    directoryId: integer('directory_id')
      .notNull()
      .references(() => directories.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    caseText: text('case_text').notNull(),
    /** Sanitised inline HTML. */
    pick: text('pick').notNull(),
    ...version,
    updatedAt: timestamps.updatedAt,
  },
  (t) => [unique().on(t.directoryId, t.position)],
);

export const revisions = pgTable(
  'revisions',
  {
    id: serial('id').primaryKey(),
    directoryId: integer('directory_id')
      .notNull()
      .references(() => directories.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    date: date('date').notNull(),
    /** Sanitised inline HTML. */
    text: text('text').notNull(),
    ...version,
    updatedAt: timestamps.updatedAt,
  },
  (t) => [unique().on(t.directoryId, t.position)],
);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  /** scrypt: salt and hash, hex, "scrypt$N$r$p$salt$hash". */
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamps.createdAt,
});

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 of the cookie token; the token itself is never stored. */
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    csrfToken: text('csrf_token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [index('sessions_user').on(t.userId), index('sessions_expiry').on(t.expiresAt)],
);

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: serial('id').primaryKey(),
    /** The client address, or the e-mail tried; both are rate limited. */
    key: text('key').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('login_attempts_key_at').on(t.key, t.at)],
);

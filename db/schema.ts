import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const profiles = sqliteTable('profiles', {
  owner: text('owner').primaryKey(),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(0),
});

export const applications = sqliteTable('applications', {
  id: text('id').notNull(),
  owner: text('owner').notNull(),
  url: text('url').notNull(),
  status: text('status').notNull(),
  data: text('data').notNull(),
  revision: integer('revision').notNull().default(0),
  updated: text('updated').notNull(),
}, t => [primaryKey({columns:[t.owner, t.id]}),
  uniqueIndex('applications_owner_url').on(t.owner, t.url),
  index('applications_owner_updated').on(t.owner, t.updated)]);

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  jobId: text('job_id').notNull(),
  action: text('action').notNull(),
  timestamp: text('timestamp').notNull(),
}, t => [index('events_owner_job').on(t.owner, t.jobId)]);

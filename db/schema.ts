import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const checks = sqliteTable("checks", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  createdAt: text("created_at").notNull(),
  name: text("name").notNull(),
  media: text("media").notNull(),
  mediaType: text("media_type").notNull(),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  result: text("result").notNull(),
  shared: integer("shared").notNull().default(0),
  listed: integer("listed").notNull().default(0),
  shareToken: text("share_token"),
}, t => [index("checks_owner_idx").on(t.owner), index("checks_feed_idx").on(t.listed)]);

// Reservations stay charged against the allowance even after a connection is lost.
export const sponsorships = sqliteTable('sponsorships', {
  checkId:text('check_id').primaryKey(),
  owner:text('owner').notNull(),
  day:text('day').notNull(),
  reservedMicros:integer('reserved_micros').notNull(),
  activeUntil:integer('active_until').notNull(),
},t=>[index('sponsorships_day_idx').on(t.day),index('sponsorships_owner_day_idx').on(t.owner,t.day)]);

export const uploads = sqliteTable('uploads', {
  id:text('id').primaryKey(),
  owner:text('owner').notNull(),
  createdAt:integer('created_at').notNull(),
  expiresAt:integer('expires_at').notNull(),
  name:text('name').notNull(),
  contentType:text('content_type').notNull(),
  size:integer('size').notNull(),
  publicUrl:text('public_url'),
},t=>[index('uploads_owner_created_idx').on(t.owner,t.createdAt),index('uploads_created_idx').on(t.createdAt)]);

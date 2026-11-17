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

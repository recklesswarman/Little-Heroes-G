import { relations } from 'drizzle-orm';
import { integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Define the 'users' table (required by Cloud SQL skill with Firebase Auth UID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').default('hero'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Define the 'hero_profiles' table with foreign key to 'users'
export const heroProfiles = pgTable('hero_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  name: text('name').notNull(),
  heroLevel: integer('hero_level').default(1).notNull(),
  heroXp: integer('hero_xp').default(0).notNull(),
  coins: integer('coins').default(0).notNull(),
  points: integer('points').default(0).notNull(),
  streakDays: integer('streak_days').default(1).notNull(),
  stats: jsonb('stats'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Define 'chores' table
export const chores = pgTable('chores', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  title: text('title').notNull(),
  category: text('category').default('hygiene'),
  coinsReward: integer('coins_reward').default(10),
  completed: text('completed').default('pending'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define relationships
export const usersRelations = relations(users, ({ many }) => ({
  heroProfiles: many(heroProfiles),
  chores: many(chores),
}));

export const heroProfilesRelations = relations(heroProfiles, ({ one }) => ({
  user: one(users, {
    fields: [heroProfiles.userId],
    references: [users.id],
  }),
}));

export const choresRelations = relations(chores, ({ one }) => ({
  user: one(users, {
    fields: [chores.userId],
    references: [users.id],
  }),
}));

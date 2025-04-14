import { pgTable, text, serial, integer, boolean, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  profilePicture: text("profile_picture"),
  githubId: text("github_id").unique(),
  name: text("name"),
  bio: text("bio"),
  title: text("title"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  role: true,
  profilePicture: true,
  githubId: true,
  name: true,
  bio: true,
  title: true,
  createdAt: true,
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  status: text("status").notNull().default("active"),
  approved: boolean("approved").default(false),
  collaborators: integer("collaborators").notNull().default(0),
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  name: true,
});

export const comparisons = pgTable("comparisons", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  name: text("name"),
  description: text("description"),
  designImagePath: text("design_image_path").notNull(),
  websiteImagePath: text("website_image_path").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastComparedAt: timestamp("last_compared_at"),
  usedFallback: boolean("used_fallback").default(false),
});

export const insertComparisonSchema = createInsertSchema(comparisons).pick({
  projectId: true,
  name: true,
  description: true,
  designImagePath: true,
  websiteImagePath: true,
  status: true,
  createdAt: true,
  usedFallback: true
});

export const discrepancies = pgTable("discrepancies", {
  id: serial("id").primaryKey(),
  comparisonId: integer("comparison_id").notNull(),
  title: text("title").notNull(),
  description: text("description"), // Made optional
  type: text("type").notNull(),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  coordinates: jsonb("coordinates").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDiscrepancySchema = createInsertSchema(discrepancies).pick({
  comparisonId: true,
  title: true,
  description: true,
  type: true,
  priority: true,
  coordinates: true,
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  discrepancyId: integer("discrepancy_id").notNull(),
  userId: integer("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCommentSchema = createInsertSchema(comments).pick({
  discrepancyId: true,
  userId: true,
  content: true,
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  userId: integer("user_id"),
  type: text("type").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activities).pick({
  projectId: true,
  userId: true,
  type: true,
  description: true,
  createdAt: true,
});

// Project collaborators table - junction table between projects and users
export const projectCollaborators = pgTable("project_collaborators", {
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text("status").notNull().default("active"),
  role: text("role").notNull(),
  addedAt: timestamp("added_at").notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at").notNull().defaultNow(),
}, (table) => {
  return {
    pk: primaryKey(table.projectId, table.userId),
  }
});

export const insertProjectCollaboratorSchema = createInsertSchema(projectCollaborators).pick({
  projectId: true,
  userId: true,
  role: true,
  status: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type ProjectCollaborator = typeof projectCollaborators.$inferSelect;
export type InsertProjectCollaborator = z.infer<typeof insertProjectCollaboratorSchema>;

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  projectCollaborations: many(projectCollaborators),
  comments: many(comments),
  activities: many(activities),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  collaborators: many(projectCollaborators),
  comparisons: many(comparisons),
  activities: many(activities),
}));

export const projectCollaboratorsRelations = relations(projectCollaborators, ({ one }) => ({
  user: one(users, {
    fields: [projectCollaborators.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [projectCollaborators.projectId],
    references: [projects.id],
  }),
}));

export const comparisonsRelations = relations(comparisons, ({ one, many }) => ({
  project: one(projects, {
    fields: [comparisons.projectId],
    references: [projects.id],
  }),
  discrepancies: many(discrepancies),
}));

export const discrepanciesRelations = relations(discrepancies, ({ one, many }) => ({
  comparison: one(comparisons, {
    fields: [discrepancies.comparisonId],
    references: [comparisons.id],
  }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  discrepancy: one(discrepancies, {
    fields: [comments.discrepancyId],
    references: [discrepancies.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  project: one(projects, {
    fields: [activities.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
}));

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Comparison = typeof comparisons.$inferSelect;
export type InsertComparison = z.infer<typeof insertComparisonSchema>;

export type Discrepancy = typeof discrepancies.$inferSelect;
export type InsertDiscrepancy = z.infer<typeof insertDiscrepancySchema>;

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

// Priority types
export const PriorityTypes = ["high", "medium", "low"] as const;
export type PriorityType = typeof PriorityTypes[number];

// Discrepancy types
export const DiscrepancyTypes = ["color", "size", "typography", "position", "layout", "other"] as const;
export type DiscrepancyType = typeof DiscrepancyTypes[number];

// Status types
export const StatusTypes = ["open", "in-progress", "resolved"] as const;
export type StatusType = typeof StatusTypes[number];

// Activity types
export const ActivityTypes = [
  "project_created", 
  "comparison_run", 
  "comparison_created",
  "comparison_rerun",
  "discrepancy_added", 
  "discrepancy_updated", 
  "comment_added", 
  "user_invited",
  "collaborator_added",
  "collaborator_removed"
] as const;
export type ActivityType = typeof ActivityTypes[number];

// User role types
export const RoleTypes = ["user", "designer", "developer", "qa"] as const;
export type RoleType = typeof RoleTypes[number];

// Collaborator status types
export const CollaboratorStatusTypes = ["pending", "active", "inactive"] as const;
export type CollaboratorStatusType = typeof CollaboratorStatusTypes[number];

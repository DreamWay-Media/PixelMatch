import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
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
  designImagePath: text("design_image_path").notNull(),
  websiteImagePath: text("website_image_path").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastComparedAt: timestamp("last_compared_at"),
});

export const insertComparisonSchema = createInsertSchema(comparisons).pick({
  projectId: true,
  designImagePath: true,
  websiteImagePath: true, 
});

export const discrepancies = pgTable("discrepancies", {
  id: serial("id").primaryKey(),
  comparisonId: integer("comparison_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
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
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

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
  "discrepancy_added", 
  "discrepancy_updated", 
  "comment_added", 
  "user_invited"
] as const;
export type ActivityType = typeof ActivityTypes[number];

// User role types
export const RoleTypes = ["user", "designer", "developer", "qa"] as const;
export type RoleType = typeof RoleTypes[number];

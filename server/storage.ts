import {
  projects, type Project, type InsertProject,
  comparisons, type Comparison, type InsertComparison,
  discrepancies, type Discrepancy, type InsertDiscrepancy,
  comments, type Comment, type InsertComment,
  activities, type Activity, type InsertActivity,
  users, type User, type InsertUser
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { db, pool } from "./db";
import session from "express-session";
import connectPg from "connect-pg-simple";

export interface IStorage {
  // Session store for authentication
  sessionStore: session.Store;
  
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Project operations
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<Project>): Promise<Project | undefined>;
  
  // Comparison operations
  getComparisons(projectId?: number): Promise<Comparison[]>;
  getComparison(id: number): Promise<Comparison | undefined>;
  createComparison(comparison: InsertComparison): Promise<Comparison>;
  updateComparison(id: number, comparison: Partial<Comparison>): Promise<Comparison | undefined>;
  
  // Discrepancy operations
  getDiscrepancies(comparisonId?: number): Promise<Discrepancy[]>;
  getDiscrepancy(id: number): Promise<Discrepancy | undefined>;
  createDiscrepancy(discrepancy: InsertDiscrepancy): Promise<Discrepancy>;
  updateDiscrepancy(id: number, discrepancy: Partial<Discrepancy>): Promise<Discrepancy | undefined>;
  
  // Comment operations
  getComments(discrepancyId?: number): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  
  // Activity operations
  getActivities(projectId?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private projects: Map<number, Project>;
  private comparisons: Map<number, Comparison>;
  private discrepancies: Map<number, Discrepancy>;
  private comments: Map<number, Comment>;
  private activities: Map<number, Activity>;
  
  private userCurrentId: number;
  private projectCurrentId: number;
  private comparisonCurrentId: number;
  private discrepancyCurrentId: number;
  private commentCurrentId: number;
  private activityCurrentId: number;
  
  // Add session store for authentication
  public sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.projects = new Map();
    this.comparisons = new Map();
    this.discrepancies = new Map();
    this.comments = new Map();
    this.activities = new Map();
    
    this.userCurrentId = 1;
    this.projectCurrentId = 1;
    this.comparisonCurrentId = 1;
    this.discrepancyCurrentId = 1;
    this.commentCurrentId = 1;
    this.activityCurrentId = 1;
    
    // Initialize session store using memorystore
    // We're using dynamic import since we're in ES module context
    import('memorystore').then(memorystore => {
      const MemoryStore = memorystore.default(session);
      this.sessionStore = new MemoryStore({
        checkPeriod: 86400000 // Prune expired entries every 24h
      });
    });
    
    // Temporary store until the dynamic import completes
    this.sessionStore = new session.Store();
    
    // Initialize with sample data for development
    this.initializeSampleData();
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Project operations
  async getProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }
  
  async getProject(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
  }
  
  async createProject(insertProject: InsertProject): Promise<Project> {
    const id = this.projectCurrentId++;
    const now = new Date();
    const project: Project = { 
      ...insertProject, 
      id, 
      createdAt: now, 
      updatedAt: now,
      status: "active",
      approved: false,
      collaborators: 0
    };
    this.projects.set(id, project);
    return project;
  }
  
  async updateProject(id: number, projectUpdate: Partial<Project>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    const updatedProject = { ...project, ...projectUpdate, updatedAt: new Date() };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }
  
  // Comparison operations
  async getComparisons(projectId?: number): Promise<Comparison[]> {
    const comparisons = Array.from(this.comparisons.values());
    if (projectId !== undefined) {
      return comparisons.filter(comparison => comparison.projectId === projectId);
    }
    return comparisons;
  }
  
  async getComparison(id: number): Promise<Comparison | undefined> {
    return this.comparisons.get(id);
  }
  
  async createComparison(insertComparison: InsertComparison): Promise<Comparison> {
    const id = this.comparisonCurrentId++;
    const now = new Date();
    const comparison: Comparison = { 
      ...insertComparison, 
      id, 
      createdAt: now,
      lastComparedAt: null  // Use null instead of undefined for Date | null
    };
    this.comparisons.set(id, comparison);
    return comparison;
  }
  
  async updateComparison(id: number, comparisonUpdate: Partial<Comparison>): Promise<Comparison | undefined> {
    const comparison = this.comparisons.get(id);
    if (!comparison) return undefined;
    
    const updatedComparison = { ...comparison, ...comparisonUpdate };
    this.comparisons.set(id, updatedComparison);
    return updatedComparison;
  }
  
  // Discrepancy operations
  async getDiscrepancies(comparisonId?: number): Promise<Discrepancy[]> {
    const discrepancies = Array.from(this.discrepancies.values());
    if (comparisonId !== undefined) {
      return discrepancies.filter(discrepancy => discrepancy.comparisonId === comparisonId);
    }
    return discrepancies;
  }
  
  async getDiscrepancy(id: number): Promise<Discrepancy | undefined> {
    return this.discrepancies.get(id);
  }
  
  async createDiscrepancy(insertDiscrepancy: InsertDiscrepancy): Promise<Discrepancy> {
    const id = this.discrepancyCurrentId++;
    const now = new Date();
    const discrepancy: Discrepancy = { 
      ...insertDiscrepancy, 
      id, 
      createdAt: now,
      status: "open"
    };
    this.discrepancies.set(id, discrepancy);
    return discrepancy;
  }
  
  async updateDiscrepancy(id: number, discrepancyUpdate: Partial<Discrepancy>): Promise<Discrepancy | undefined> {
    const discrepancy = this.discrepancies.get(id);
    if (!discrepancy) return undefined;
    
    const updatedDiscrepancy = { ...discrepancy, ...discrepancyUpdate };
    this.discrepancies.set(id, updatedDiscrepancy);
    return updatedDiscrepancy;
  }
  
  // Comment operations
  async getComments(discrepancyId?: number): Promise<Comment[]> {
    const comments = Array.from(this.comments.values());
    if (discrepancyId !== undefined) {
      return comments.filter(comment => comment.discrepancyId === discrepancyId);
    }
    return comments;
  }
  
  async createComment(insertComment: InsertComment): Promise<Comment> {
    const id = this.commentCurrentId++;
    const now = new Date();
    const comment: Comment = { 
      ...insertComment, 
      id, 
      createdAt: now
    };
    this.comments.set(id, comment);
    return comment;
  }
  
  // Activity operations
  async getActivities(projectId?: number): Promise<Activity[]> {
    const activities = Array.from(this.activities.values());
    if (projectId !== undefined) {
      return activities.filter(activity => activity.projectId === projectId);
    }
    return activities;
  }
  
  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const id = this.activityCurrentId++;
    const now = new Date();
    const activity: Activity = { 
      ...insertActivity, 
      id, 
      createdAt: now
    };
    this.activities.set(id, activity);
    return activity;
  }
  
  private initializeSampleData() {
    // Create a few users
    const user1 = this.createUser({
      username: "sarah_designer",
      email: "sarah@example.com", 
      password: "password", 
      role: "designer"
    });
    
    const user2 = this.createUser({
      username: "tom_developer",
      email: "tom@example.com", 
      password: "password", 
      role: "developer"
    });
    
    const user3 = this.createUser({
      username: "mark_qa",
      email: "mark@example.com", 
      password: "password", 
      role: "qa"
    });
    
    // Create a sample project
    const project = this.createProject({ name: "Homepage Redesign" });
  }
}

// Database-backed storage implementation
export class DatabaseStorage implements IStorage {
  // Session store for authentication
  public sessionStore: session.Store;

  constructor() {
    // Initialize the PostgreSQL session store
    const PostgresSessionStore = connectPg(session);
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  
  // Project operations
  async getProjects(): Promise<Project[]> {
    return db.select().from(projects);
  }
  
  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }
  
  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject).returning();
    return project;
  }
  
  async updateProject(id: number, projectUpdate: Partial<Project>): Promise<Project | undefined> {
    const [updatedProject] = await db
      .update(projects)
      .set({ ...projectUpdate, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updatedProject;
  }
  
  // Comparison operations
  async getComparisons(projectId?: number): Promise<Comparison[]> {
    if (projectId) {
      return db.select().from(comparisons).where(eq(comparisons.projectId, projectId));
    }
    return db.select().from(comparisons);
  }
  
  async getComparison(id: number): Promise<Comparison | undefined> {
    const [comparison] = await db.select().from(comparisons).where(eq(comparisons.id, id));
    return comparison;
  }
  
  async createComparison(insertComparison: InsertComparison): Promise<Comparison> {
    const [comparison] = await db.insert(comparisons).values(insertComparison).returning();
    return comparison;
  }
  
  async updateComparison(id: number, comparisonUpdate: Partial<Comparison>): Promise<Comparison | undefined> {
    const [updatedComparison] = await db
      .update(comparisons)
      .set(comparisonUpdate)
      .where(eq(comparisons.id, id))
      .returning();
    return updatedComparison;
  }
  
  // Discrepancy operations
  async getDiscrepancies(comparisonId?: number): Promise<Discrepancy[]> {
    if (comparisonId) {
      return db.select().from(discrepancies).where(eq(discrepancies.comparisonId, comparisonId));
    }
    return db.select().from(discrepancies);
  }
  
  async getDiscrepancy(id: number): Promise<Discrepancy | undefined> {
    const [discrepancy] = await db.select().from(discrepancies).where(eq(discrepancies.id, id));
    return discrepancy;
  }
  
  async createDiscrepancy(insertDiscrepancy: InsertDiscrepancy): Promise<Discrepancy> {
    const [discrepancy] = await db.insert(discrepancies).values(insertDiscrepancy).returning();
    return discrepancy;
  }
  
  async updateDiscrepancy(id: number, discrepancyUpdate: Partial<Discrepancy>): Promise<Discrepancy | undefined> {
    const [updatedDiscrepancy] = await db
      .update(discrepancies)
      .set(discrepancyUpdate)
      .where(eq(discrepancies.id, id))
      .returning();
    return updatedDiscrepancy;
  }
  
  // Comment operations
  async getComments(discrepancyId?: number): Promise<Comment[]> {
    if (discrepancyId) {
      return db.select().from(comments).where(eq(comments.discrepancyId, discrepancyId));
    }
    return db.select().from(comments);
  }
  
  async createComment(insertComment: InsertComment): Promise<Comment> {
    const [comment] = await db.insert(comments).values(insertComment).returning();
    return comment;
  }
  
  // Activity operations
  async getActivities(projectId?: number): Promise<Activity[]> {
    if (projectId) {
      return db.select().from(activities).where(eq(activities.projectId, projectId));
    }
    return db.select().from(activities);
  }
  
  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const [activity] = await db.insert(activities).values(insertActivity).returning();
    return activity;
  }
}

// Use database storage when in production or explicitly requested
export const storage = process.env.USE_DATABASE === "true" || process.env.NODE_ENV === "production"
  ? new DatabaseStorage()
  : new MemStorage();

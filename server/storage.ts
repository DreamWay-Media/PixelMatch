import {
  projects, type Project, type InsertProject,
  comparisons, type Comparison, type InsertComparison,
  discrepancies, type Discrepancy, type InsertDiscrepancy,
  comments, type Comment, type InsertComment,
  activities, type Activity, type InsertActivity,
  users, type User, type InsertUser
} from "@shared/schema";

export interface IStorage {
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
      lastComparedAt: undefined
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
    const user1 = this.createUser({ username: "sarah_designer", password: "password", role: "designer" });
    const user2 = this.createUser({ username: "tom_developer", password: "password", role: "developer" });
    const user3 = this.createUser({ username: "mark_qa", password: "password", role: "qa" });
    
    // Create a sample project
    const project = this.createProject({ name: "Homepage Redesign" });
  }
}

export const storage = new MemStorage();

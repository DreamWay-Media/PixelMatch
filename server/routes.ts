import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { compareImages, saveUploadedFile } from "./services/comparisonService";
import multer from "multer";
import { z } from "zod";
import { insertProjectSchema, insertDiscrepancySchema, insertCommentSchema } from "@shared/schema";
import path from "path";
import fs from "fs";
import { setupAuth } from "./auth";

// Configure multer for in-memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB file size limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    // Accept only image files and PDFs
    const allowedFileTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedFileTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.') as any);
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  // Serve uploaded files
  app.use("/uploads", (req, res, next) => {
    // Only serve from the uploads directory
    const filePath = path.join(uploadsDir, path.basename(req.path));
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      next();
    }
  });

  // API Routes
  
  // Project endpoints
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const validatedData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(validatedData);
      
      // Log activity
      await storage.createActivity({
        projectId: project.id,
        type: "project_created",
        description: `Project "${project.name}" was created`,
        userId: null
      });
      
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  // Comparison endpoints
  app.get("/api/projects/:projectId/comparisons", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const comparisons = await storage.getComparisons(projectId);
      res.json(comparisons);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch comparisons" });
    }
  });

  app.get("/api/comparisons/:id", async (req, res) => {
    try {
      const comparisonId = parseInt(req.params.id);
      const comparison = await storage.getComparison(comparisonId);
      
      if (!comparison) {
        return res.status(404).json({ message: "Comparison not found" });
      }
      
      // Get discrepancies for this comparison
      const discrepancies = await storage.getDiscrepancies(comparisonId);
      
      // Get comments for each discrepancy
      const discrepanciesWithComments = await Promise.all(
        discrepancies.map(async (discrepancy) => {
          const comments = await storage.getComments(discrepancy.id);
          return {
            ...discrepancy,
            comments
          };
        })
      );
      
      res.json({
        ...comparison,
        discrepancies: discrepanciesWithComments
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch comparison details" });
    }
  });

  // Upload and comparison endpoint
  app.post(
    "/api/projects/:projectId/compare",
    upload.fields([
      { name: 'design', maxCount: 1 },
      { name: 'website', maxCount: 1 }
    ]),
    async (req: Request, res: Response) => {
      try {
        const projectId = parseInt(req.params.projectId);
        const project = await storage.getProject(projectId);
        
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }
        
        // Check if files were uploaded
        const files = req.files as { [fieldname: string]: any[] };
        
        if (!files.design || !files.website) {
          return res.status(400).json({ message: "Both design and website files are required" });
        }
        
        // Save uploaded files
        const designFile = files.design[0];
        const websiteFile = files.website[0];
        
        const designPath = await saveUploadedFile(designFile);
        const websitePath = await saveUploadedFile(websiteFile);
        
        // Run comparison
        const result = await compareImages(designPath, websitePath, projectId);
        
        res.status(201).json(result);
      } catch (error) {
        console.error("Error processing comparison:", error);
        const multerError = error as any;
        if (multerError && multerError.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: "File size exceeds 20MB limit" });
        }
        res.status(500).json({ message: "Failed to process comparison" });
      }
    }
  );

  // Discrepancy endpoints
  app.get("/api/comparisons/:comparisonId/discrepancies", async (req, res) => {
    try {
      const comparisonId = parseInt(req.params.comparisonId);
      const discrepancies = await storage.getDiscrepancies(comparisonId);
      res.json(discrepancies);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch discrepancies" });
    }
  });

  app.post("/api/comparisons/:comparisonId/discrepancies", async (req, res) => {
    try {
      const comparisonId = parseInt(req.params.comparisonId);
      const comparison = await storage.getComparison(comparisonId);
      
      if (!comparison) {
        return res.status(404).json({ message: "Comparison not found" });
      }
      
      const discrepancyData = { ...req.body, comparisonId };
      const validatedData = insertDiscrepancySchema.parse(discrepancyData);
      
      const discrepancy = await storage.createDiscrepancy(validatedData);
      
      // Log activity
      await storage.createActivity({
        projectId: comparison.projectId,
        type: "discrepancy_added",
        description: `New discrepancy "${discrepancy.title}" was added`,
        userId: req.body.userId || null
      });
      
      res.status(201).json(discrepancy);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid discrepancy data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create discrepancy" });
    }
  });

  app.patch("/api/discrepancies/:id", async (req, res) => {
    try {
      const discrepancyId = parseInt(req.params.id);
      const discrepancy = await storage.getDiscrepancy(discrepancyId);
      
      if (!discrepancy) {
        return res.status(404).json({ message: "Discrepancy not found" });
      }
      
      const updatedDiscrepancy = await storage.updateDiscrepancy(discrepancyId, req.body);
      
      // Log activity
      const comparison = await storage.getComparison(discrepancy.comparisonId);
      if (comparison) {
        await storage.createActivity({
          projectId: comparison.projectId,
          type: "discrepancy_updated",
          description: `Discrepancy "${updatedDiscrepancy?.title}" was updated`,
          userId: req.body.userId || null
        });
      }
      
      res.json(updatedDiscrepancy);
    } catch (error) {
      res.status(500).json({ message: "Failed to update discrepancy" });
    }
  });

  // Comment endpoints
  app.get("/api/discrepancies/:discrepancyId/comments", async (req, res) => {
    try {
      const discrepancyId = parseInt(req.params.discrepancyId);
      const comments = await storage.getComments(discrepancyId);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/discrepancies/:discrepancyId/comments", async (req, res) => {
    try {
      const discrepancyId = parseInt(req.params.discrepancyId);
      const discrepancy = await storage.getDiscrepancy(discrepancyId);
      
      if (!discrepancy) {
        return res.status(404).json({ message: "Discrepancy not found" });
      }
      
      const commentData = { ...req.body, discrepancyId };
      const validatedData = insertCommentSchema.parse(commentData);
      
      const comment = await storage.createComment(validatedData);
      
      // Log activity
      const comparison = await storage.getComparison(discrepancy.comparisonId);
      if (comparison) {
        await storage.createActivity({
          projectId: comparison.projectId,
          type: "comment_added",
          description: "Comment was added to a discrepancy",
          userId: comment.userId
        });
      }
      
      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid comment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Activity endpoints
  app.get("/api/projects/:projectId/activities", async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const activities = await storage.getActivities(projectId);
      
      // Sort by creation date, newest first
      activities.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

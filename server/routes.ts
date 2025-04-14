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
  
  // Create profile pictures directory if it doesn't exist
  const profilePicsDir = path.join(uploadsDir, "profiles");
  if (!fs.existsSync(profilePicsDir)) {
    fs.mkdirSync(profilePicsDir, { recursive: true });
  }
  
  // Serve uploaded files
  app.use("/uploads", (req, res, next) => {
    // Only serve from the uploads directory
    const filePath = path.join(uploadsDir, req.path.replace(/^\/+/, ''));
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
      // NOTE: Authentication check temporarily disabled for testing
      // if (!req.isAuthenticated()) {
      //   return res.status(401).json({ message: "Not authenticated" });
      // }
      
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
      // NOTE: Authentication check temporarily disabled for testing
      // if (!req.isAuthenticated()) {
      //   return res.status(401).json({ message: "Not authenticated" });
      // }
      
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
      // NOTE: Authentication check temporarily disabled for testing
      // if (!req.isAuthenticated()) {
      //   return res.status(401).json({ message: "Not authenticated" });
      // }
      
      const projectId = parseInt(req.params.projectId);
      const comparisons = await storage.getComparisons(projectId);
      res.json(comparisons);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch comparisons" });
    }
  });
  
  // Create a new comparison (empty report that will be filled with image uploads later)
  app.post("/api/projects/:projectId/comparisons", async (req, res) => {
    try {
      // NOTE: Authentication check temporarily disabled for testing
      // if (!req.isAuthenticated()) {
      //   return res.status(401).json({ message: "Not authenticated" });
      // }
      
      const projectId = parseInt(req.params.projectId);
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Get name and description from the request body
      const { name, description, status } = req.body;
      
      // Create a new empty comparison record
      const comparison = await storage.createComparison({
        projectId,
        name: name || `Report ${new Date().toLocaleDateString()}`,
        description: description || `Report for project "${project.name}"`,
        status: status || "pending",
        // Use placeholder image paths until actual files are uploaded
        designImagePath: "uploads/placeholder.png",
        websiteImagePath: "uploads/placeholder.png",
        createdAt: new Date()
      });
      
      // Add activity for the new comparison
      await storage.createActivity({
        projectId,
        type: "comparison_created",
        description: `New report "${comparison.name}" created`,
        userId: req.user?.id || null,
        createdAt: new Date()
      });
      
      res.status(201).json(comparison);
    } catch (error) {
      console.error("Error creating comparison:", error);
      res.status(500).json({ message: "Failed to create comparison" });
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
      // Validate file types for security
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      
      if (files.design && files.website) {
        const designFile = files.design[0];
        const websiteFile = files.website[0];
        
        if (!allowedMimeTypes.includes(designFile.mimetype) || !allowedMimeTypes.includes(websiteFile.mimetype)) {
          return res.status(400).json({ 
            message: "Invalid file type. Only JPEG, PNG and PDF files are allowed." 
          });
        }
      }
      try {
        // NOTE: Authentication check temporarily disabled for comparison testing
        // if (!req.isAuthenticated()) {
        //   return res.status(401).json({ message: "Not authenticated" });
        // }
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
        
        // Get report name and description from form data, if provided
        const name = req.body.name || `Comparison ${new Date().toLocaleDateString()}`;
        const description = req.body.description || `Automated comparison for project "${project.name}"`;
        
        // Create comparison record first with the provided name and description
        // Start with status "processing" so UI can show loading state
        const comparison = await storage.createComparison({
          projectId,
          name,
          description,
          designImagePath: designPath,
          websiteImagePath: websitePath,
          createdAt: new Date(),
          status: "processing" // Start with processing status
        });
        
        let result;
        try {
          // Run comparison analysis with the created comparison ID
          result = await compareImages(designPath, websitePath, projectId, comparison.id);
          
          // Update the status to completed
          await storage.updateComparison(comparison.id, { status: "completed" });
        } catch (analysisError) {
          console.error("Error during image analysis:", analysisError);
          
          // Mark as completed even if there was an error
          // This ensures the UI won't stay in a perpetual loading state
          await storage.updateComparison(comparison.id, { 
            status: "completed",
            description: "Analysis failed or timed out. You can still add manual discrepancies."
          });
          
          // Set result with empty discrepancies
          result = {
            comparison: await storage.getComparison(comparison.id),
            discrepancies: []
          };
        }
        
        // Add activity for the new comparison
        await storage.createActivity({
          projectId,
          type: "comparison_created",
          description: `New comparison "${name}" created with ${result.discrepancies.length} discrepancies`,
          userId: req.user?.id || null,
          createdAt: new Date()
        });
        
        res.status(201).json(result);
      } catch (error) {
        console.error("Error processing comparison:", error);
        const multerError = error as any;
        
        if (multerError && multerError.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: "File size exceeds 20MB limit" });
        }
        
        // Log detailed error for debugging
        console.error("Comparison error details:", {
          projectId: req.params.projectId,
          files: req.files ? Object.keys(req.files as object) : 'No files',
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        
        res.status(500).json({ 
          message: "Failed to process comparison. Please try again or contact support.",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  
  // Re-compare endpoint - reuse existing design and website images
  app.post(
    "/api/projects/:projectId/recompare",
    async (req: Request, res: Response) => {
      try {
        // NOTE: Authentication check temporarily disabled for comparison testing
        // if (!req.isAuthenticated()) {
        //   return res.status(401).json({ message: "Not authenticated" });
        // }
        
        const projectId = parseInt(req.params.projectId);
        const project = await storage.getProject(projectId);
        
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }
        
        // Get image paths from request body
        const { designImagePath, websiteImagePath, originalComparisonId } = req.body;
        
        if (!designImagePath || !websiteImagePath) {
          return res.status(400).json({ message: "Both design and website image paths are required" });
        }
        
        // Get the original comparison information for naming
        let name = `Reanalysis ${new Date().toLocaleDateString()}`;
        let description = "Re-run of previous comparison";
        
        if (originalComparisonId) {
          const originalComparison = await storage.getComparison(parseInt(originalComparisonId));
          if (originalComparison) {
            name = `Reanalysis of "${originalComparison.name}"`;
            description = `Re-run of comparison: ${originalComparison.description}`;
          }
        }
        
        // Create a new comparison record
        const comparison = await storage.createComparison({
          projectId,
          name,
          description,
          designImagePath: designImagePath,
          websiteImagePath: websiteImagePath,
          createdAt: new Date(),
          status: "completed"
        });
        
        // Run comparison with the new comparison ID
        const result = await compareImages(designImagePath, websiteImagePath, projectId, comparison.id);
        
        // Log activity
        await storage.createActivity({
          projectId,
          type: "comparison_rerun", 
          description: `Re-ran comparison analysis`,
          userId: req.user?.id || null
        });
        
        res.status(201).json(result);
      } catch (error) {
        console.error("Error re-running comparison:", error);
        
        // Log detailed error for debugging
        console.error("Recompare error details:", {
          projectId: req.params.projectId,
          designImagePath: req.body.designImagePath,
          websiteImagePath: req.body.websiteImagePath,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        
        res.status(500).json({ 
          message: "Failed to re-run comparison. Please try again or contact support.",
          error: error instanceof Error ? error.message : "Unknown error"
        });
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
      // NOTE: Authentication check temporarily disabled for testing
      // if (!req.isAuthenticated()) {
      //   return res.status(401).json({ message: "Not authenticated" });
      // }
      
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
      // NOTE: Authentication check temporarily disabled for testing
      // if (!req.isAuthenticated()) {
      //   return res.status(401).json({ message: "Not authenticated" });
      // }
      
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

  app.delete("/api/discrepancies/:id", async (req, res) => {
    try {
      // NOTE: Authentication check temporarily disabled for testing
      // if (!req.isAuthenticated()) {
      //   return res.status(401).json({ message: "Not authenticated" });
      // }
      
      const discrepancyId = parseInt(req.params.id);
      const discrepancy = await storage.getDiscrepancy(discrepancyId);
      
      if (!discrepancy) {
        return res.status(404).json({ message: "Discrepancy not found" });
      }
      
      // Store this info before deletion for activity logging
      const discrepancyTitle = discrepancy.title;
      const comparisonId = discrepancy.comparisonId;
      
      const deleted = await storage.deleteDiscrepancy(discrepancyId);
      
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete discrepancy" });
      }
      
      // Log activity
      const comparison = await storage.getComparison(comparisonId);
      if (comparison) {
        await storage.createActivity({
          projectId: comparison.projectId,
          type: "discrepancy_updated",
          description: `Discrepancy "${discrepancyTitle}" was deleted`,
          userId: req.body.userId || null
        });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting discrepancy:", error);
      res.status(500).json({ message: "Failed to delete discrepancy" });
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
  
  // User endpoints
  app.get("/api/users/search", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const username = req.query.username?.toString();
      if (!username) {
        return res.status(400).json({ message: "Username parameter is required" });
      }
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't return the password
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error searching for user:", error);
      res.status(500).json({ message: "Failed to search for user" });
    }
  });
  
  // Profile picture upload endpoint
  app.post("/api/users/profile-picture", 
    upload.single('profilePicture'),
    async (req, res) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        
        // Check if file was uploaded
        if (!req.file) {
          return res.status(400).json({ message: "No profile picture uploaded" });
        }
        
        const userId = req.user!.id;
        
        // Validate file type for security
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
          return res.status(400).json({ 
            message: "Invalid file type. Only JPEG, PNG and GIF files are allowed for profile pictures." 
          });
        }
        
        // Generate a unique filename with user id and sanitize the filename
        const fileExtension = path.extname(req.file.originalname).replace(/[^a-zA-Z0-9-.]/g, '');
        const filename = `user_${userId}_${Date.now()}${fileExtension}`;
        
        // Use the more secure saveUploadedFile function
        const profilePicPath = await saveUploadedFile({
          ...req.file,
          originalname: filename // Use our sanitized filename
        });
        
        // Update user profile in the database
        const user = await storage.updateUser(userId, {
          profilePicture: `/${profilePicPath}`
        });
        
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        // Return updated user without password
        const { password, ...updatedUser } = user;
        res.json(updatedUser);
      } catch (error) {
        console.error("Error uploading profile picture:", error);
        res.status(500).json({ message: "Failed to upload profile picture" });
      }
    }
  );
  
  // Get current user profile
  app.get("/api/users/profile", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't return the password
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });
  
  // Update user profile
  app.patch("/api/users/profile", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userId = req.user!.id;
      const user = await storage.updateUser(userId, req.body);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't return the password
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });
  
  // Collaborator routes
  app.get("/api/projects/:projectId/collaborators", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const projectId = parseInt(req.params.projectId);
      const collaborators = await storage.getProjectCollaborators(projectId);
      res.json(collaborators);
    } catch (error) {
      console.error("Error fetching collaborators:", error);
      res.status(500).json({ message: "Failed to fetch collaborators" });
    }
  });
  
  app.post("/api/projects/:projectId/collaborators", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const projectId = parseInt(req.params.projectId);
      const userId = req.body.userId;
      const role = req.body.role;
      const status = req.body.status || "active";
      
      // Check if project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if collaborator already exists
      const existingCollaborator = await storage.getProjectCollaborator(projectId, userId);
      if (existingCollaborator) {
        return res.status(409).json({ message: "User is already a collaborator on this project" });
      }
      
      const collaborator = await storage.addProjectCollaborator({
        projectId,
        userId,
        role,
        status
      });
      
      // Create an activity record for the addition
      await storage.createActivity({
        projectId,
        userId: req.user?.id,
        type: "collaborator_added",
        description: `${req.user?.username || 'A user'} added ${user.username} as a ${role} to the project`
      });
      
      res.status(201).json(collaborator);
    } catch (error) {
      console.error("Error adding collaborator:", error);
      res.status(500).json({ message: "Failed to add collaborator" });
    }
  });
  
  app.delete("/api/projects/:projectId/collaborators/:userId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const projectId = parseInt(req.params.projectId);
      const userId = parseInt(req.params.userId);
      
      // Check if collaborator exists
      const collaborator = await storage.getProjectCollaborator(projectId, userId);
      if (!collaborator) {
        return res.status(404).json({ message: "Collaborator not found" });
      }
      
      const success = await storage.removeProjectCollaborator(projectId, userId);
      
      if (success) {
        // Get the user details for the activity log
        const user = await storage.getUser(userId);
        
        // Create an activity record for the removal
        await storage.createActivity({
          projectId,
          userId: req.user?.id,
          type: "collaborator_removed",
          description: `${req.user?.username || 'A user'} removed ${user?.username || 'a user'} from the project`
        });
        
        res.status(204).end();
      } else {
        res.status(500).json({ message: "Failed to remove collaborator" });
      }
    } catch (error) {
      console.error("Error removing collaborator:", error);
      res.status(500).json({ message: "Failed to remove collaborator" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

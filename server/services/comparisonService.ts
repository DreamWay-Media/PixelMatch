import path from "path";
import fs from "fs/promises";
import { storage } from "../storage";
import { InsertComparison, InsertDiscrepancy } from "@shared/schema";

// Mock AI comparison for the MVP
export async function compareImages(designPath: string, websitePath: string, projectId: number) {
  try {
    // First, create a comparison record
    const comparisonData: InsertComparison = {
      projectId,
      designImagePath: designPath,
      websiteImagePath: websitePath
    };
    
    const comparison = await storage.createComparison(comparisonData);
    
    // Update the comparison with the current timestamp
    await storage.updateComparison(comparison.id, {
      lastComparedAt: new Date()
    });
    
    // For MVP, we'll generate some mock discrepancies
    // In a real implementation, this would use computer vision or ML to detect differences
    
    const mockDiscrepancies = [
      {
        title: "Button Color Mismatch",
        description: "Primary button color is #3B82F6 in design but #2563EB in implementation",
        type: "color",
        priority: "high",
        coordinates: {
          x: 250,
          y: 120,
          width: 96,
          height: 32,
          shape: "rectangle"
        }
      },
      {
        title: "Logo Size Difference",
        description: "Logo is 64×64px in design but 56×56px in implementation",
        type: "size",
        priority: "medium",
        coordinates: {
          x: 400,
          y: 200,
          width: 64,
          height: 64,
          shape: "circle" 
        }
      },
      {
        title: "Font Weight Inconsistency",
        description: "Heading uses font-weight 700 in design but 600 in implementation",
        type: "typography",
        priority: "low",
        coordinates: {
          x: 150,
          y: 300,
          width: 128,
          height: 48,
          shape: "rectangle"
        }
      }
    ];
    
    // Create discrepancy records
    const createdDiscrepancies = await Promise.all(
      mockDiscrepancies.map(discrepancy => 
        storage.createDiscrepancy({
          comparisonId: comparison.id,
          title: discrepancy.title,
          description: discrepancy.description,
          type: discrepancy.type,
          priority: discrepancy.priority,
          coordinates: discrepancy.coordinates
        } as InsertDiscrepancy)
      )
    );
    
    // Log activity
    await storage.createActivity({
      projectId,
      type: "comparison_run",
      description: `AI Analysis found ${createdDiscrepancies.length} discrepancies between design and implementation`,
      userId: null
    });
    
    return {
      comparison,
      discrepancies: createdDiscrepancies
    };
  } catch (error) {
    console.error("Error in comparison service:", error);
    throw error;
  }
}

// Function to handle file uploads
export async function saveUploadedFile(file: Express.Multer.File): Promise<string> {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  
  try {
    // Create uploads directory if it doesn't exist
    await fs.mkdir(uploadsDir, { recursive: true });
    
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.originalname}`;
    const filepath = path.join(uploadsDir, filename);
    
    // Save the file
    await fs.writeFile(filepath, file.buffer);
    
    // Return the relative path
    return path.join('uploads', filename);
  } catch (error) {
    console.error("Error saving file:", error);
    throw error;
  }
}

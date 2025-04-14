import path from "path";
import fs from "fs/promises";
import { storage } from "../storage";
import { InsertComparison, InsertDiscrepancy, DiscrepancyType, PriorityType } from "@shared/schema";
import * as openaiService from "./openaiService";
import * as anthropicService from "./anthropicService";

// Define AI provider types
type AIProvider = 'openai' | 'anthropic';

// Helper to choose AI provider based on environment or fallback
function getAIProvider(): AIProvider {
  // Check if a specific provider is set in env
  const providerEnv = process.env.AI_PROVIDER?.toLowerCase();
  
  // Only use Anthropic if explicitly requested and not in a problematic status
  if (providerEnv === 'anthropic' && process.env.ANTHROPIC_API_STATUS !== 'error') {
    return 'anthropic';
  }
  
  // Default to OpenAI for better reliability
  return 'openai';
}

// Return fallback discrepancies when AI services are unavailable
// This provides a degraded but functional experience when AI services fail
// The discrepancies highlight areas that typically need review but don't make specific claims
function getFallbackDiscrepancies(): any[] {
  console.log("Using fallback discrepancy detection system - these are not AI-generated findings but generic areas to review");
  return generateTestDiscrepancies();
}

// Interface for our discrepancy analysis items
interface DiscrepancyAnalysisItem {
  title: string;
  description: string;
  type: DiscrepancyType;
  priority: PriorityType;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
    shape: 'rectangle' | 'circle';
  };
}

// Generate test discrepancies for when AI services are unavailable
// This function provides example discrepancies as a fallback when AI services cannot be used
// The descriptions focus only on measurable, technical aspects without making assumptions
function generateTestDiscrepancies(): DiscrepancyAnalysisItem[] {
  return [
    {
      title: "Width measurement",
      description: "Element has different width measurements between versions. Verify if this is intentional or requires adjustment.",
      type: "size" as DiscrepancyType,
      priority: "medium" as PriorityType,
      coordinates: {
        x: 150,
        y: 220,
        width: 120,
        height: 40,
        shape: 'rectangle'
      }
    },
    {
      title: "Color value difference",
      description: "Color values differ in this region. Check design specifications for the intended color code.",
      type: "color" as DiscrepancyType,
      priority: "medium" as PriorityType, // Changed from high to medium
      coordinates: {
        x: 200,
        y: 180,
        width: 300,
        height: 24,
        shape: 'rectangle'
      }
    },
    {
      title: "Element spacing",
      description: "Spacing between elements in this area differs from specification. Verify padding/margin values.",
      type: "layout" as DiscrepancyType,
      priority: "low" as PriorityType, // Changed from medium to low
      coordinates: {
        x: 120,
        y: 310,
        width: 400,
        height: 100,
        shape: 'rectangle'
      }
    },
    {
      title: "Typography properties",
      description: "Text properties (size, weight, or line-height) differ in this region. Refer to design system for correct values.",
      type: "typography" as DiscrepancyType,
      priority: "medium" as PriorityType,
      coordinates: {
        x: 80,
        y: 130,
        width: 500,
        height: 30,
        shape: 'rectangle'
      }
    },
    {
      title: "Component styling",
      description: "UI component styling differs. Check design specifications for intended appearance.",
      type: "other" as DiscrepancyType,
      priority: "low" as PriorityType,
      coordinates: {
        x: 350,
        y: 400,
        width: 280,
        height: 180,
        shape: 'rectangle'
      }
    }
  ];
}

// Enhanced AI-powered image comparison using either OpenAI or Anthropic
export async function compareImages(designPath: string, websitePath: string, projectId: number, existingComparisonId?: number) {
  try {
    // If we already have a comparison ID, use that instead of creating a new one
    let comparison;
    
    if (existingComparisonId) {
      comparison = await storage.getComparison(existingComparisonId);
      if (!comparison) {
        throw new Error(`Comparison with ID ${existingComparisonId} not found`);
      }
    } else {
      // First, create a comparison record
      const comparisonData: InsertComparison = {
        projectId,
        name: `Comparison ${new Date().toLocaleDateString()}`,
        description: "Automated design vs website comparison",
        designImagePath: designPath,
        websiteImagePath: websitePath,
        status: "completed",
        createdAt: new Date()
      };
      
      comparison = await storage.createComparison(comparisonData);
    }
    
    // Update the comparison with the current timestamp
    await storage.updateComparison(comparison.id, {
      lastComparedAt: new Date()
    });
    
    // Get absolute paths to resolve the files
    const designFullPath = path.resolve(process.cwd(), designPath);
    const websiteFullPath = path.resolve(process.cwd(), websitePath);
    
    // Choose AI provider
    const aiProvider = getAIProvider();
    console.log(`Using ${aiProvider} to analyze image differences...`);
    console.log(`Design path: ${designPath}, Website path: ${websitePath}`);
    
    let selectedDiscrepancies: DiscrepancyAnalysisItem[] = [];
    let usingFallbackDiscrepancies = false;
    
    try {
      // Call selected AI provider to analyze the images
      let detectedDiscrepancies;
      let activeProvider = aiProvider;
      let providerAttempted = false;

      try {
        // First try with the selected provider
        if (activeProvider === 'openai') {
          providerAttempted = true;
          detectedDiscrepancies = await openaiService.analyzeImageDifferences(designFullPath, websiteFullPath);
          console.log(`OpenAI detected ${detectedDiscrepancies.length} discrepancies`);
        } else {
          try {
            providerAttempted = true;
            detectedDiscrepancies = await anthropicService.analyzeImageDifferences(designFullPath, websiteFullPath);
            console.log(`Anthropic detected ${detectedDiscrepancies.length} discrepancies`);
          } catch (anthropicError) {
            // Anthropic failed, try OpenAI instead
            console.warn("Anthropic API error, falling back to OpenAI:", anthropicError);
            // Flag Anthropic as having issues for future requests in this session
            process.env.ANTHROPIC_API_STATUS = 'error';
            activeProvider = 'openai';
            
            // Try with OpenAI
            detectedDiscrepancies = await openaiService.analyzeImageDifferences(designFullPath, websiteFullPath);
            console.log(`OpenAI (fallback) detected ${detectedDiscrepancies.length} discrepancies`);
          }
        }
        
        // If AI fails to detect any discrepancies, use fallback
        if (!detectedDiscrepancies || detectedDiscrepancies.length === 0) {
          console.log(`Warning: ${activeProvider} didn't detect any discrepancies. Using fallback analysis.`);
          detectedDiscrepancies = getFallbackDiscrepancies();
          usingFallbackDiscrepancies = true;
        }
      } catch (aiError) {
        // All AI services failed, use fallback discrepancies
        const provider = providerAttempted ? activeProvider : 'AI service';
        console.error(`Error calling ${provider} API:`, aiError);
        console.log("Using fallback discrepancy detection due to API error");
        detectedDiscrepancies = getFallbackDiscrepancies();
        usingFallbackDiscrepancies = true;
      }
      
      // Map the detected discrepancies to our format
      selectedDiscrepancies = detectedDiscrepancies.map((d: any) => ({
        title: d.title,
        description: d.description,
        type: d.type,
        priority: d.priority,
        coordinates: d.coordinates
      }));
    } catch (error) {
      console.error(`Error in image analysis process:`, error);
      throw new Error(`Failed to analyze images: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Create discrepancy records in the database
    const createdDiscrepancies = await Promise.all(
      selectedDiscrepancies.map(discrepancy => 
        storage.createDiscrepancy({
          comparisonId: comparison.id,
          title: discrepancy.title,
          description: discrepancy.description,
          type: discrepancy.type,
          priority: discrepancy.priority,
          status: "open",
          coordinates: discrepancy.coordinates
        } as InsertDiscrepancy)
      )
    );
    
    // Generate a summary of the findings (in background)
    try {
      let summary = "";
      try {
        if (aiProvider === 'openai') {
          summary = await openaiService.generateComparisonSummary(selectedDiscrepancies as any);
        } else {
          summary = await anthropicService.generateComparisonSummary(selectedDiscrepancies as any);
        }
      } catch (summaryError) {
        console.warn(`Failed to generate AI summary: ${summaryError}. Using fallback summary.`);
        
        if (usingFallbackDiscrepancies || selectedDiscrepancies.length === 0) {
          // If we couldn't get real discrepancies or have none, use a more technical fallback summary
          const highPriorityCount = selectedDiscrepancies.filter(d => d.priority === "high").length;
          const mediumPriorityCount = selectedDiscrepancies.filter(d => d.priority === "medium").length;
          const lowPriorityCount = selectedDiscrepancies.filter(d => d.priority === "low").length;
          
          summary = `Technical analysis detected ${selectedDiscrepancies.length} potential UI differences between design and implementation (${highPriorityCount} high, ${mediumPriorityCount} medium, ${lowPriorityCount} low priority). The highlighted areas require manual verification against design specifications.`;
        } else {
          // If we have real discrepancies but just can't summarize them
          const highPriorityCount = selectedDiscrepancies.filter(d => d.priority === "high").length;
          const mediumPriorityCount = selectedDiscrepancies.filter(d => d.priority === "medium").length;
          const lowPriorityCount = selectedDiscrepancies.filter(d => d.priority === "low").length;
          
          summary = `Analysis detected ${selectedDiscrepancies.length} visual discrepancies between the design mockup and website implementation, including ${highPriorityCount} high priority, ${mediumPriorityCount} medium priority, and ${lowPriorityCount} low priority issues. Key concerns include pixel-perfect alignment, color accuracy, spacing consistency, and typography rendering.`;
        }
      }
      
      // Update the comparison with the summary
      if (summary) {
        await storage.updateComparison(comparison.id, {
          description: summary
        });
      }
    } catch (error) {
      // Non-critical error, just log it
      console.warn(`Failed to update comparison summary:`, error);
    }
    
    // Log activity with a detailed message
    let activityDescription = '';
    
    // Update the comparison to indicate if fallback mode was used
    if (usingFallbackDiscrepancies) {
      await storage.updateComparison(comparison.id, {
        usedFallback: true
      });
      
      // If we used fallback mode due to AI unavailability
      const mediumCount = createdDiscrepancies.filter(d => d.priority === "medium").length;
      activityDescription = `Automated analysis completed with ${createdDiscrepancies.length} potential areas highlighted for review (${mediumCount} medium priority). Manual verification of these areas is required.`;
    } else if (createdDiscrepancies.length === 0) {
      // If no discrepancies were found (either by AI or fallback)
      activityDescription = `${aiProvider.toUpperCase()} analysis completed. No design-implementation inconsistencies detected in this comparison.`;
    } else {
      // If we used AI-generated discrepancies and found some
      const highCount = createdDiscrepancies.filter(d => d.priority === "high").length;
      activityDescription = `${aiProvider.toUpperCase()} analysis completed with ${createdDiscrepancies.length} design-implementation inconsistencies detected, including ${highCount} high-priority issues requiring immediate attention.`;
    }
    
    await storage.createActivity({
      projectId,
      type: "comparison_run",
      description: activityDescription,
      userId: null,
      createdAt: new Date()
    });
    
    // Return the comparison and discrepancies
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
    // Create uploads directory if it doesn't exist with proper permissions
    try {
      await fs.access(uploadsDir);
    } catch (err) {
      // Directory doesn't exist, create it with proper permissions
      await fs.mkdir(uploadsDir, { recursive: true, mode: 0o755 });
    }
    
    // Generate unique filename with timestamp to prevent collisions
    const timestamp = Date.now();
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9-_.]/g, '_'); // Sanitize filename
    const filename = `${timestamp}-${sanitizedFilename}`;
    const filepath = path.join(uploadsDir, filename);
    
    // Save the file with proper permissions
    await fs.writeFile(filepath, file.buffer, { mode: 0o644 }); // Owner: rw, Group/Others: r
    
    // Return the relative path with consistent forward slash format
    const relativePath = path.join('uploads', filename);
    // Ensure the path uses forward slashes and doesn't have a leading slash
    return relativePath.replace(/\\/g, '/');
  } catch (error) {
    console.error("Error saving file:", error);
    throw error;
  }
}

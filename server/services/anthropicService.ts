import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { DiscrepancyType, PriorityType, StatusType } from '@shared/schema';

// Initialize the Anthropic client
// Note: the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface VisualDiscrepancy {
  title: string;
  description: string;
  type: DiscrepancyType;
  priority: PriorityType;
  status: StatusType;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
    shape: 'rectangle' | 'circle';
  };
}

/**
 * Analyze two images and detect visual discrepancies using Anthropic's Claude vision capabilities
 */
export async function analyzeImageDifferences(
  designImagePath: string,
  websiteImagePath: string
): Promise<VisualDiscrepancy[]> {
  try {
    // Read images as base64
    const designImageBase64 = fs.readFileSync(path.resolve(designImagePath)).toString('base64');
    const websiteImageBase64 = fs.readFileSync(path.resolve(websiteImagePath)).toString('base64');

    // Prepare the prompt for Anthropic
    const systemPrompt = `You are an expert UI/UX analyst specializing in comparing design mockups with their implemented websites. 
    You'll analyze two images: a design mockup and its website implementation, identifying visual discrepancies.
    
    Focus on the following types of discrepancies:
    - color: Different colors used in elements (e.g., buttons, text, backgrounds)
    - size: Differences in size of elements (e.g., buttons, images, text)
    - typography: Font style, size, weight, spacing, or type differences
    - position: Misalignment or different positioning of elements
    - layout: Overall structural differences in layout
    - other: Any other visual discrepancies not covered above
    
    For each discrepancy, determine a priority:
    - high: Critical issues that significantly impact user experience or brand identity
    - medium: Important issues that should be fixed but don't break functionality
    - low: Minor cosmetic issues
    
    Provide specific, actionable feedback for each discrepancy.`;

    const userPrompt = `I need to compare these two images: the first is the design mockup, the second is the implemented website. Identify all visual discrepancies between them. Respond with JSON in the following format (return exactly 3-6 discrepancies):
[
  {
    "title": "Brief description of discrepancy",
    "description": "Detailed explanation of the issue",
    "type": "color|size|typography|position|layout|other",
    "priority": "high|medium|low",
    "coordinates": {
      "x": relative x position (0-100),
      "y": relative y position (0-100),
      "width": relative width (0-100),
      "height": relative height (0-100),
      "shape": "rectangle|circle"
    }
  }
]`;

    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      system: systemPrompt,
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: designImageBase64
              }
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: websiteImageBase64
              }
            }
          ]
        }
      ],
    });

    // Safely extract text content from the response
    const contentBlock = response.content[0];
    // Type guard to ensure we're working with a text block
    if (!contentBlock || typeof contentBlock !== 'object' || !('type' in contentBlock) || contentBlock.type !== 'text') {
      throw new Error("Empty or invalid response from Anthropic");
    }
    
    // Now TypeScript knows this is a text block and has a text property
    const content = (contentBlock as { type: 'text', text: string }).text;
    if (!content) {
      throw new Error("Empty response from Anthropic");
    }

    try {
      // Find the JSON array in the response
      // Using a more compatible approach without 's' flag which might not be supported in all TS configs
      const jsonString = content.replace(/\n/g, ' ');
      let jsonMatch = null;
      
      // Look for an array pattern that starts with [ and contains at least one object { }
      const bracketStart = jsonString.indexOf('[');
      if (bracketStart !== -1) {
        const bracketEnd = jsonString.lastIndexOf(']');
        if (bracketEnd > bracketStart) {
          jsonMatch = [jsonString.substring(bracketStart, bracketEnd + 1)];
        }
      }
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      
      const parsed = JSON.parse(jsonStr);
      
      // Add status field to each discrepancy and convert to our internal format
      const discrepancies: VisualDiscrepancy[] = Array.isArray(parsed) ? 
        parsed.map(item => ({
          ...item,
          status: "open" as StatusType, // Default status is open
        })) : [];

      return discrepancies;
    } catch (error) {
      console.error("Failed to parse Anthropic response:", content);
      throw new Error("Failed to parse Anthropic response");
    }
  } catch (error) {
    console.error("Error analyzing images with Anthropic:", error);
    throw error;
  }
}

/**
 * Generate a summary of discrepancies for a comparison report
 */
export async function generateComparisonSummary(discrepancies: VisualDiscrepancy[]): Promise<string> {
  try {
    if (discrepancies.length === 0) {
      return "No discrepancies found between the design and implementation.";
    }

    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Based on the following discrepancies found between a design mockup and website implementation, 
          write a concise professional summary (max 150 words) that highlights the main issues and their impact:
          
          ${JSON.stringify(discrepancies, null, 2)}`
        }
      ]
    });

    const contentBlock = response.content[0];
    // Type guard to ensure we're working with a text block
    if (contentBlock && typeof contentBlock === 'object' && 'type' in contentBlock && contentBlock.type === 'text') {
      return (contentBlock as { type: 'text', text: string }).text || "Summary could not be generated.";
    }
    
    return "Summary could not be generated.";
  } catch (error) {
    console.error("Error generating comparison summary with Anthropic:", error);
    return "An error occurred while generating the comparison summary.";
  }
}
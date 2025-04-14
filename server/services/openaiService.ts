import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { DiscrepancyType, PriorityType, StatusType } from '@shared/schema';

// Initialize the OpenAI client
// Note: the newest OpenAI model is "gpt-4o" which was released May 13, 2024. 
// Do not change this unless explicitly requested by the user.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
 * Analyze two images and detect visual discrepancies using OpenAI's Vision capabilities
 */
export async function analyzeImageDifferences(
  designImagePath: string,
  websiteImagePath: string
): Promise<VisualDiscrepancy[]> {
  try {
    // Validate that the file paths exist
    try {
      await fs.promises.access(designImagePath, fs.constants.R_OK);
      await fs.promises.access(websiteImagePath, fs.constants.R_OK);
    } catch (err: any) {
      console.error(`Image file not found or not readable:`, err);
      throw new Error(`Image file not found: ${err?.message || 'Unknown error'}`);
    }
    
    // Read images as base64
    const designImageBase64 = fs.readFileSync(path.resolve(designImagePath)).toString('base64');
    const websiteImageBase64 = fs.readFileSync(path.resolve(websiteImagePath)).toString('base64');

    // Check if image data is valid
    if (!designImageBase64 || !websiteImageBase64) {
      throw new Error("Could not read image files properly");
    }

    // Prepare the prompt for OpenAI
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

    // Attempt to create the OpenAI completion with retries
    let attempts = 0;
    const maxAttempts = 3;
    let lastError = null;

    while (attempts < maxAttempts) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "I need to compare these two images: the first is the design mockup, the second is the implemented website. Identify all visual discrepancies between them. Respond with JSON in the following format (return exactly 3-6 discrepancies):\n" +
                  "[\n" +
                  "  {\n" +
                  "    \"title\": \"Brief description of discrepancy\",\n" +
                  "    \"description\": \"Detailed explanation of the issue\",\n" +
                  "    \"type\": \"color|size|typography|position|layout|other\",\n" +
                  "    \"priority\": \"high|medium|low\",\n" +
                  "    \"coordinates\": {\n" +
                  "      \"x\": relative x position (0-100),\n" +
                  "      \"y\": relative y position (0-100),\n" +
                  "      \"width\": relative width (0-100),\n" +
                  "      \"height\": relative height (0-100),\n" +
                  "      \"shape\": \"rectangle|circle\"\n" +
                  "    }\n" +
                  "  }\n" +
                  "]"
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${designImageBase64}`,
                    detail: "high"
                  }
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${websiteImageBase64}`,
                    detail: "high"
                  }
                }
              ],
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 4000,
        });

        const content = response.choices[0].message.content;
        if (!content) {
          throw new Error("Empty response from OpenAI");
        }

        try {
          // Handle the case where OpenAI might not return a valid JSON array
          let parsed;
          if (content.trim().startsWith('{') && content.includes('"discrepancies":')) {
            // If OpenAI returned an object with a discrepancies array inside
            const contentObj = JSON.parse(content);
            parsed = contentObj.discrepancies || [];
          } else {
            // Direct JSON array or other format
            parsed = JSON.parse(content);
          }
          
          // Ensure we have an array, even if parsing succeeded but didn't yield an array
          if (!Array.isArray(parsed)) {
            console.warn("OpenAI did not return a proper array, using empty array instead");
            parsed = [];
          }
          
          // Add status field to each discrepancy and convert to our internal format
          const discrepancies: VisualDiscrepancy[] = parsed.map(item => ({
            ...item,
            status: "open" as StatusType, // Default status is open
            // Ensure coordinates are valid
            coordinates: {
              x: Number(item.coordinates?.x) || 0,
              y: Number(item.coordinates?.y) || 0,
              width: Number(item.coordinates?.width) || 10,
              height: Number(item.coordinates?.height) || 10,
              shape: item.coordinates?.shape || 'rectangle'
            }
          }));

          return discrepancies;
        } catch (error) {
          console.error("Failed to parse OpenAI response:", content);
          throw new Error(`Failed to parse OpenAI response: ${(error as Error).message || 'Unknown error'}`);
        }
      } catch (error: any) {
        console.warn(`OpenAI request attempt ${attempts + 1} failed:`, error.message || 'Unknown error');
        lastError = error;
        attempts++;
        // Wait before retrying (exponential backoff)
        if (attempts < maxAttempts) {
          const delay = Math.pow(2, attempts) * 500; // 1s, 2s, 4s, etc.
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error(`OpenAI request failed after ${maxAttempts} attempts:`, lastError);
    throw lastError || new Error("OpenAI request failed");
  } catch (error) {
    console.error("Error analyzing images with OpenAI:", error);
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert UI/UX analyst writing summaries of design implementation issues.",
        },
        {
          role: "user",
          content: `Based on the following discrepancies found between a design mockup and website implementation, 
          write a concise professional summary (max 150 words) that highlights the main issues and their impact:
          
          ${JSON.stringify(discrepancies, null, 2)}`,
        },
      ],
      max_tokens: 300,
    });

    return response.choices[0].message.content || "Summary could not be generated.";
  } catch (error) {
    console.error("Error generating comparison summary:", error);
    return "An error occurred while generating the comparison summary.";
  }
}
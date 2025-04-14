import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function testAnthropic() {
  try {
    console.log("Testing Anthropic API connection...");
    const response = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 10,
      messages: [{ role: 'user', content: "Hello, can you hear me? Just reply with yes or no." }],
    });
    
    console.log("Anthropic API response:", response.content[0].text);
    console.log("Anthropic API connection successful!");
    return true;
  } catch (error) {
    console.error("Anthropic API Error:", error.message);
    console.error("Full error:", error);
    return false;
  }
}

testAnthropic();

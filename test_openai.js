import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testOpenAI() {
  try {
    console.log("Testing OpenAI API connection...");
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello, can you hear me? Just reply with yes or no." }],
      max_tokens: 10
    });
    
    console.log("OpenAI API response:", response.choices[0].message.content);
    console.log("OpenAI API connection successful!");
    return true;
  } catch (error) {
    console.error("OpenAI API Error:", error.message);
    if (error.status === 429) {
      console.error("This appears to be a rate limit or quota exceeded error.");
    }
    return false;
  }
}

testOpenAI();

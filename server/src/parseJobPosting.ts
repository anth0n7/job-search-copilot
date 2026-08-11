import Anthropic from '@anthropic-ai/sdk';

//creates a client object, once, same rool as pool for postgres. A reusable connection referenced whenever you need to talk to that service
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

//reusable function that takes raw job posting text and returns structured data
export async function parseJobPosting(rawText: string){
    //acutal API call
    const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
            {
                role: 'user',
                content: `Extract structured information from this job posting. Respond with only vaild JSON, no other text, in exactly this shape:
                {
                    "seniority: "string, e.g. 'entry-level', 'mid', 'senior'",
                    "required_skills": ["array", "of", "strings"],
                    "responsibilities": ["array", "of", "strings"]
                }

                Job posting:
                ${rawText}`,      
            },
        ],
    });

    //.? handles the "what if theres nothing there" edge case
    const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '';
    //converts the text response into a real Javascript object
    const cleanedText = responseText.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    return JSON.parse(cleanedText);
}
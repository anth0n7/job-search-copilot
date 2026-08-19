import Anthropic from '@anthropic-ai/sdk';


const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateSuggestions(resumeText: string, jobPostingRawText: string, missingSkills: string[]){
    const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
            {
                 role: 'user',
                content: `Given this resume and job posting, suggest specific bullet point rewrites that better highlight the candidate's fit for this role, especially addressing the missing skills listed below where genuinely possible. Also draft a short cover letter.
                Only suggest rewrites based on experience that is actually present in the resume. Do not invent skills, experience, or accomplishments that are not genuinely there.
                Respond with only valid JSON, no other text, in exactly this shape:
                {
                    "suggested_changes": [
                        {"original": "a real line from the resume", "suggested": "a rewritten version", "reason": "why this change helps"}
                    ],
                    "cover_letter_draft": "a short cover letter as a single string"
                }

                Resume:
                ${resumeText}

                Job Posting:
                ${jobPostingRawText}

                Missing Skills:
                ${missingSkills.join(', ')}`      
            },
        ],
    });

    //.? handles the "what if theres nothing there" edge case
    const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '';
    //converts the text response into a real Javascript object
    const cleanedText = responseText.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    return JSON.parse(cleanedText);

}
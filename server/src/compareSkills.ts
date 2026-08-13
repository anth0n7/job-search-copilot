import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function compareSkills(resumeText: string, requiredSkills: string[]){
    const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
            {
                role: 'user',
                content: `Compare Resume against Required Skills fill matched skills with skills found in both and missing skills with those found only in Required Skills and not Resume Text.
                Only mark a skill as matched if it is explicitly stated or clearly and directly demonstrated in the resume text. Do not infer or assume skills based on related techonolgies or general experience.
                Respond with only vaild JSON, no other text, in exactly this shape:
                {
                    "matched_skills": ["array", "of", "strings"],
                    "missing_skills": ["array", "of", "strings"]
                }

                Resume: ${resumeText}
                 
                Required Skills: ${requiredSkills.join(', ')}`,      
            },
        ],
    });

    const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '';
    const cleanedText = responseText.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    return JSON.parse(cleanedText);

}

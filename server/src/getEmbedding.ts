export async function getEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            input: text,
            model: 'voyage-4-lite',
        }),
    });

    if(!response.ok){
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData));
    }

    const data = await response.json();
    return data.data[0].embedding;

}
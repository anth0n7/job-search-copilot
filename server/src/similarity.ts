function dotProduct(vecA: number[], vecB: number[]): number {
    if(vecA.length !== vecB.length){
        throw new Error('Vectors must be the same length');
    }
    return vecA.reduce((sum,value,index) => sum + value * vecB[index]!, 0);
}

function magnitude(vector: number[]): number {
    const product = vector.reduce((sum, value) => sum + value * value, 0);
    return Math.sqrt(product);   
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    return dotProduct(vecA, vecB) / (magnitude(vecA) * magnitude(vecB));
}
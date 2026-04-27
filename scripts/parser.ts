import { openai } from "./openai";

export async function generateDocs(code: string) {
  const prompt = `
You are NestJS Swagger generator.

Rules:
- DO NOT change logic
- DO NOT change formatting
- ONLY add swagger decorators
- Skip decorators if already exists
- DTO → ApiProperty
- Controller → ApiOperation ApiResponse ApiTags ApiBearerAuth ApiQuery
- return full file

Code:
${code}
`;

try {
      const res = await openai.chat.completions.create({
    model: "gpt-5.3",
    messages: [
      {
        role: "system",
        content: "You are a senior NestJS Swagger generator",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return res.choices[0].message.content!;
} catch (error) {
    console.error(error);
}
}
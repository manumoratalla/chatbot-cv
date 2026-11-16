// Responde una pregunta con RAG: buscar fragmentos → instrucciones → modelo.

import { rankChunks, selectChunks } from './retrieval.js';
import { buildInstructions } from './prompt.js';
import { generateReply } from './openai.js';

// Una pregunta de seguimiento ("¿Y en qué año fue?") no dice de qué se habla,
// así que se busca con la pregunta anterior del usuario más la actual.
export function buildSearchText(question, history = []) {
  const previousQuestion = history.findLast((item) => item.role === 'user')?.content;
  return previousQuestion ? `${previousQuestion}\n${question}` : question;
}

export async function answerQuestion(question, history = []) {
  const rankedChunks = await rankChunks(buildSearchText(question, history));
  const chunks = selectChunks(rankedChunks);
  const instructions = buildInstructions(chunks);
  const reply = await generateReply(instructions, [...history, { role: 'user', content: question }]);

  return { reply, chunks, rankedChunks };
}

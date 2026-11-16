// Herramienta de depuración: muestra qué fragmentos encuentra la búsqueda
// (con su puntuación) y la respuesta del modelo.

import readline from 'node:readline/promises';
import { rankChunks, selectChunks } from '../lib/retrieval.js';
import { answerQuestion, buildSearchText } from '../lib/chat.js';
import { MIN_SCORE, TOP_K, MAX_HISTORY_MESSAGES } from '../lib/config.js';

const SHOW_TOP = 10;
const args = process.argv.slice(2);
const searchOnly = args.includes('--search-only');
const questionFromArgs = args.filter((arg) => !arg.startsWith('--')).join(' ').trim();

// [x] elegido por parecido · [+] añadido (mismo tema o contacto) · [ ] no se usa
function printRanking(rankedChunks, selectedChunks) {
  const bySimilarity = rankedChunks.filter((c) => c.score >= MIN_SCORE).slice(0, TOP_K);
  const mark = (chunk) => {
    if (bySimilarity.includes(chunk)) return '[x]';
    return selectedChunks.includes(chunk) ? '[+]' : '[ ]';
  };

  console.log(`\n--- Fragmentos (umbral ${MIN_SCORE} · [x] por parecido · [+] añadido) ---`);
  const shown = rankedChunks.slice(0, SHOW_TOP);
  for (const chunk of shown) console.log(`${mark(chunk)} ${chunk.score.toFixed(3)}  ${chunk.id}`);
  for (const chunk of selectedChunks.filter((c) => !shown.includes(c))) {
    console.log(`[+] ${chunk.score.toFixed(3)}  ${chunk.id}`);
  }
}

async function askOnce(question, history = []) {
  if (searchOnly) {
    const rankedChunks = await rankChunks(buildSearchText(question, history));
    printRanking(rankedChunks, selectChunks(rankedChunks));
    return null;
  }

  const { reply, chunks, rankedChunks } = await answerQuestion(question, history);
  printRanking(rankedChunks, chunks);
  console.log(`\n=== RESPUESTA ===\n${reply}\n`);
  return reply;
}

async function main() {
  if (questionFromArgs) {
    await askOnce(questionFromArgs);
    return;
  }

  console.log('MODO CONVERSACIÓN ("nueva" = empezar otra conversación, "salir" = terminar)');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let history = [];

  while (true) {
    const question = (await rl.question('\nPregunta: ')).trim();
    if (['salir', 'exit', 'quit'].includes(question.toLowerCase())) break;
    if (question.toLowerCase() === 'nueva') {
      history = [];
      console.log('(Conversación reiniciada)');
      continue;
    }
    if (!question) continue;

    try {
      const reply = await askOnce(question, history);
      if (reply) {
        history.push({ role: 'user', content: question }, { role: 'assistant', content: reply });
        history = history.slice(-MAX_HISTORY_MESSAGES);
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
  }

  rl.close();
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exitCode = 1;
});

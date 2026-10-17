import { generateText } from 'ai';

async function main() {
  const { text } = await generateText({
    model: 'moonshotai/kimi-k3',
    prompt:
      'Invent a new holiday. Give it a name, when it is celebrated, and describe its traditions.',
  });

  console.log(text);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

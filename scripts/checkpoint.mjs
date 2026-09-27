import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const name = process.argv[2];
const choices = ['03-start', '03-signin', '03-state', '03-complete'];
if (!choices.includes(name)) {
  console.error(`Choose a checkpoint: npm run checkpoint -- ${choices.join(' | ')}`);
  process.exitCode = 1;
} else {
  const source = path.join(root, 'checkpoints', `${name}.js`);
  await readFile(source); // Verify the source exists before replacing the file.
  await mkdir(path.join(root, 'backups'), { recursive: true });
  const backup = `auth-${Date.now()}.js`;
  await copyFile(path.join(root, 'src', 'auth.js'), path.join(root, 'backups', backup));
  await copyFile(source, path.join(root, 'src', 'auth.js'));
  console.log(`Loaded ${name}. Your previous auth.js is in backups/${backup}.`);
  console.log('Your Firebase configuration was preserved. Refresh the browser.');
}

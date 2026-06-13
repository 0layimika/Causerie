import { cp, mkdir, rm } from 'node:fs/promises';

const outputDir = process.argv.includes('--public') ? 'public' : 'dist';

const files = [
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'assets',
  'app'
];

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const file of files) {
  await cp(file, `${outputDir}/${file}`, { recursive: true });
}

console.log(`Built static app into ${outputDir}/`);

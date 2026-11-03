import { readFile } from "node:fs/promises";
import path from "node:path";

// Noto Sans JP (SIL Open Font License) from the @expo-google-fonts package,
// read from node_modules so no font file is kept in the repository. The paths
// are written out literally so the build can trace exactly these two files
// (a computed path makes it trace the whole project); next.config.ts lists the
// same files for the report route so deployments ship them.
let cache: Promise<{ regular: Buffer; bold: Buffer }> | null = null;

export function loadReportFonts() {
  cache ??= Promise.all([
    readFile(path.join(process.cwd(), "node_modules/@expo-google-fonts/noto-sans-jp/400Regular/NotoSansJP_400Regular.ttf")),
    readFile(path.join(process.cwd(), "node_modules/@expo-google-fonts/noto-sans-jp/700Bold/NotoSansJP_700Bold.ttf")),
  ]).then(
    ([regular, bold]) => ({ regular, bold }),
    (err) => {
      cache = null;
      throw err;
    },
  );
  return cache;
}

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Keep relative UPLOAD_DIR values anchored to the backend, even when the server
// is started from a different working directory.
export const uploadsRoot = path.resolve(backendRoot, process.env.UPLOAD_DIR || './uploads');

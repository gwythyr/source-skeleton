import { logger } from './logger';
import { helper } from './helper';

export { Router } from 'express';
export { readFile, writeFile } from 'fs/promises';
export type { Server } from 'http';

function processData(input: string): string {
  logger.info('processing');
  const result = helper.transform(input);
  return result;
}

export { processData };

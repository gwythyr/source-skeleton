import { logger } from './logger';

function processItems(items: string[]): string[] {
  const results = items.map((item) => {
    const trimmed = item.trim();
    logger.debug('Processing:', trimmed);
    return trimmed.toUpperCase();
  });
  
  const filtered = results.filter((item) => {
    return item.length > 0;
  });
  
  return filtered;
}

const transformer = (input: string): string => {
  const lines = input.split('\n');
  return lines.map((line) => {
    return line.replace(/\s+/g, ' ');
  }).join('\n');
};

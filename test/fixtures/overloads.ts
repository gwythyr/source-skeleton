import { logger } from './logger';

function format(value: string): string;
function format(value: number): string;
function format(value: string | number): string {
  logger.info('formatting', value);
  if (typeof value === 'string') {
    return value.trim();
  }
  return value.toFixed(2);
}

interface Serializer {
  serialize(data: string): Buffer;
  serialize(data: number): Buffer;
  serialize(data: object): Buffer;
}

export class DataService {
  process(input: string): string;
  process(input: number): number;
  process(input: string | number): string | number {
    logger.debug('processing', input);
    if (typeof input === 'string') return input.toUpperCase();
    return input * 2;
  }
}

export { format };

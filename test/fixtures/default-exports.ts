import { logger } from './logger';

export default function main(args: string[]): void {
  logger.info('starting', args);
  for (const arg of args) {
    console.log(arg);
  }
}

function helper(x: string): string {
  return x.trim();
}

export { helper };

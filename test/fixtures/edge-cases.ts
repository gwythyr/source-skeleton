// Empty function
function empty(): void {}

// Single-line function
function identity(x: number): number { return x; }

// Multiline signature
function createConfig(
  host: string,
  port: number,
  options: {
    ssl: boolean;
    timeout: number;
  }
): Config {
  return { host, port, ...options };
}

// No functions, just types
interface Config {
  host: string;
  port: number;
  ssl: boolean;
  timeout: number;
}

type Handler = (req: Request) => Response;

// Export constant (no body to collapse)
export const VERSION = '1.0.0';

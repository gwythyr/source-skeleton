import { logger } from './logger';

export class Config {
  private _name: string = '';
  private _port: number = 3000;

  get name(): string {
    logger.debug('getting name');
    return this._name;
  }

  set name(value: string) {
    logger.info('setting name', value);
    this._name = value;
  }

  get port(): number {
    return this._port;
  }

  set port(value: number) {
    if (value < 0 || value > 65535) {
      throw new Error('Invalid port');
    }
    this._port = value;
  }

  getAddress(): string {
    return `${this._name}:${this._port}`;
  }
}

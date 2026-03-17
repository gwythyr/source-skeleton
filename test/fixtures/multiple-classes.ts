import { EventEmitter } from 'events';

export class Animal {
  constructor(private name: string, private sound: string) {}

  speak(): string {
    return `${this.name} says ${this.sound}`;
  }
}

export class Dog extends Animal {
  constructor(name: string) {
    super(name, 'woof');
  }

  fetch(item: string): string {
    return `${item} fetched!`;
  }
}

export class Zoo {
  private animals: Animal[] = [];

  constructor(private emitter: EventEmitter) {}

  add(animal: Animal): void {
    this.animals.push(animal);
    this.emitter.emit('animal.added', animal);
  }

  count(): number {
    return this.animals.length;
  }
}

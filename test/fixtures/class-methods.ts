export class UserService {
  private cache: Map<string, User> = new Map();

  constructor(private readonly repo: UserRepo, private logger: Logger) {
    this.logger.info('UserService initialized');
  }

  async getUser(id: string): Promise<User> {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const user = await this.repo.findById(id);
    this.cache.set(id, user);
    return user;
  }

  private validateId(id: string): boolean {
    return id.length > 0 && id.length < 100;
  }

  protected formatUser(user: User): string {
    return `${user.name} (${user.email})`;
  }

  public static create(repo: UserRepo, logger: Logger): UserService {
    return new UserService(repo, logger);
  }

  static async fromConfig(config: Config): Promise<UserService> {
    const repo = await UserRepo.connect(config.dbUrl);
    const logger = new Logger(config.logLevel);
    return new UserService(repo, logger);
  }
}

interface User {
  name: string;
  email: string;
}

interface Config {
  dbUrl: string;
  logLevel: string;
}

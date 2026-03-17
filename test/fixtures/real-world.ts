import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export interface CreateProductDto {
  name: string;
  price: number;
  stock: number;
}

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly eventEmitter: EventEmitter2,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async findAll(options?: FindManyOptions<Product>): Promise<Product[]> {
    const products = await this.productRepo.find(options);
    this.eventEmitter.emit('product.listed', { count: products.length });
    return products;
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const product = this.productRepo.create(dto);
    const saved = await this.productRepo.save(product);
    const webhookUrl = this.configService.get<string>('WEBHOOK_URL');
    if (webhookUrl) {
      await firstValueFrom(this.httpService.post(webhookUrl, saved));
    }
    this.eventEmitter.emit('product.created', saved);
    return saved;
  }

  async updateStock(id: string, delta: number): Promise<Product> {
    const product = await this.findOne(id);
    product.stock += delta;
    const updated = await this.productRepo.save(product);
    this.eventEmitter.emit('product.stockUpdated', { id, delta });
    return updated;
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productRepo.remove(product);
    this.eventEmitter.emit('product.removed', { id });
  }

  static validate(dto: CreateProductDto): boolean {
    return dto.name.length > 0 && dto.price >= 0 && dto.stock >= 0;
  }
}

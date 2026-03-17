import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter } from 'events';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly eventEmitter: EventEmitter,
  ) {}

  async createOrder(data: CreateOrderDto): Promise<Order> {
    const order = this.orderRepo.create(data);
    await this.orderRepo.save(order);
    this.eventEmitter.emit('order.created', order);
    return order;
  }

  async findOrder(id: string): Promise<Order | null> {
    return this.orderRepo.findOne({ where: { id } });
  }
}

interface CreateOrderDto {
  product: string;
  quantity: number;
}

interface Order {
  id: string;
  product: string;
  quantity: number;
}

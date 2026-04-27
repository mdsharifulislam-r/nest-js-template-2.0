import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class KafkaService implements OnModuleInit {
  private readonly logger = new Logger(KafkaService.name);

  constructor(
    @Inject('KAFKA_SERVICE')
    private readonly kafka: ClientKafka,
  ) {}

  async onModuleInit() {
    this.kafka.subscribeToResponseOf('utils-event');
    await this.kafka.connect();
    this.logger.log('Kafka connected successfully');
  }

  /** Fire-and-forget: emit an event to a topic */
  emit(topic: string, message: any) {
    return this.kafka.emit(topic, { value: message });
  }

  /** Request-reply: send a message and await a response */
  send(topic: string, message: any) {
    return this.kafka.send(topic, { value: message });
  }
}

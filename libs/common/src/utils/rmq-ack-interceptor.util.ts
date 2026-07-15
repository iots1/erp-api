import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';
import { Observable, tap, catchError } from 'rxjs';
import type { Channel, Message } from 'amqplib';

@Injectable()
export class RmqAckInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      // Acknowledge the message if the function executes successfully
      tap(() => this.ackMessage(context)),

      // Acknowledge the message even if an error occurs to prevent queue blocking.
      catchError((err) => {
        this.ackMessage(context);
        throw err;
      }),
    );
  }

  private ackMessage(context: ExecutionContext): void {
    // ระบุ Generic <'rmq'> เพื่อบอก TypeScript ว่ายอมรับ context type นี้
    if (context.getType() === 'rpc') {
      const rmqContext = context.switchToRpc().getContext<RmqContext>();

      // แปลง type (Type Casting) เพื่อแก้ปัญหา no-unsafe-assignment และ no-unsafe-call
      const channel = rmqContext.getChannelRef() as Channel;
      const message = rmqContext.getMessage() as Message;

      // Ensure the message exists before attempting to acknowledge it
      if (message) {
        channel.ack(message);
      }
    }
  }
}

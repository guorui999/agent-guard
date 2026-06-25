import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AgentGuardService } from '../agent-guard.service';
import { TOOL_GUARD_METADATA } from '../agent-guard.constants';
import { ToolGuardMetadata } from '../agent-guard.decorator';

@Injectable()
export class ToolGuardInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AgentGuardService) private readonly guardService: AgentGuardService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metadata = this.reflector.get<ToolGuardMetadata>(
      TOOL_GUARD_METADATA,
      context.getHandler(),
    );

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const sessionId = metadata.sessionIdGenerator
      ? metadata.sessionIdGenerator(request)
      : request.headers['x-session-id'] || 'default';

    const args = this.extractArgs(context);

    return from(
      this.guardService.executePre(metadata.toolName, args, sessionId),
    ).pipe(
      switchMap(() => next.handle()),
      switchMap((result) =>
        from(this.guardService.executePost(metadata.toolName, result, sessionId)),
      ),
    );
  }

  private extractArgs(context: ExecutionContext): Record<string, any> {
    const request = context.switchToHttp().getRequest();

    if (request.method === 'GET') {
      return { ...request.query };
    }

    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
      return { ...request.body };
    }

    return {};
  }
}

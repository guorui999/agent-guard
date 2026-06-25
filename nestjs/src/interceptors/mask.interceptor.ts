import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AgentGuardService } from '../agent-guard.service';

@Injectable()
export class MaskInterceptor implements NestInterceptor {
  constructor(
    @Inject(AgentGuardService) private readonly guardService: AgentGuardService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      switchMap((result) =>
        from(this.guardService.executePost('*', result, 'global')),
      ),
    );
  }
}

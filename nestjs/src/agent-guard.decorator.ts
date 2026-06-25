import { SetMetadata } from '@nestjs/common';
import { TOOL_GUARD_METADATA } from './agent-guard.constants';

export interface ToolGuardMetadata {
  toolName: string;
  sessionIdGenerator?: (...args: any[]) => string;
}

export const ToolGuard = <T = any>(
  toolName: string,
  sessionIdGenerator?: (...args: any[]) => string,
): MethodDecorator => {
  return SetMetadata(TOOL_GUARD_METADATA, {
    toolName,
    sessionIdGenerator,
  } as ToolGuardMetadata);
};

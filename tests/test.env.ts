import { LogLevel } from '@credo-ts/core'
import * as envalid from 'envalid'
export const envConfig = {
  LOG_LEVEL: envalid.num({ default: LogLevel.off, devDefault: LogLevel.off }),
}

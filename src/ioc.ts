import type { IocContainer } from '@tsoa/runtime'

import { container } from 'tsyringe'

export const iocContainer: IocContainer = {
  get: (controller) => {
    return container.resolve(controller as never)
  },
}

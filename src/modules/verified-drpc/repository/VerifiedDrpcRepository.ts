import { EventEmitter, InjectionSymbols, inject, injectable, Repository, StorageService } from '@credo-ts/core'

import { VerifiedDrpcRecord } from './VerifiedDrpcRecord'

@injectable()
export class VerifiedDrpcRepository extends Repository<VerifiedDrpcRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<VerifiedDrpcRecord>,
    eventEmitter: EventEmitter
  ) {
    super(VerifiedDrpcRecord, storageService, eventEmitter)
  }
}

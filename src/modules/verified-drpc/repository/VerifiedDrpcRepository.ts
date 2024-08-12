import { EventEmitter, inject, injectable, InjectionSymbols, Repository, type StorageService } from '@credo-ts/core'

import { VerifiedDrpcRecord } from './VerifiedDrpcRecord.js'

@injectable()
export class VerifiedDrpcRepository extends Repository<VerifiedDrpcRecord> {
  public constructor(
    @inject(InjectionSymbols.StorageService) storageService: StorageService<VerifiedDrpcRecord>,
    eventEmitter: EventEmitter
  ) {
    super(VerifiedDrpcRecord, storageService, eventEmitter)
  }
}

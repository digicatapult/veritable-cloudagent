import { AnonCredsRevocationRegistryDefinition } from '@aries-framework/anoncreds/build/models/registry'
import type { TailsFileService } from './TailsFileService'
import type { AgentContext, FileSystem } from '@aries-framework/core'

import { AriesFrameworkError, InjectionSymbols, TypedArrayEncoder } from '@aries-framework/core'
import Ipfs from '../../ipfs'
import fs from 'fs'
import { uuid } from '@aries-framework/core/build/utils/uuid'
import { randomUUID } from 'crypto'
import FormData from 'form-data'

export class BasicTailsFileService implements TailsFileService {
  private tailsDirectoryPath?: string
  private tailsServerBaseUrl?: string
  private ipfs: Ipfs

  public constructor(ipfs: Ipfs, options?: { tailsDirectoryPath?: string; tailsServerBaseUrl?: string }) {
    this.tailsServerBaseUrl = options?.tailsServerBaseUrl
    this.tailsDirectoryPath = options?.tailsDirectoryPath
    this.ipfs = ipfs
  }

  public async getTailsBasePath(agentContext: AgentContext) {
    const fileSystem = agentContext.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
    const basePath = `${this.tailsDirectoryPath ?? fileSystem.cachePath}/anoncreds/tails`
    if (!(await fileSystem.exists(basePath))) {
      await fileSystem.createDirectory(`${basePath}/file`)
    }
    return basePath
  }

  public async uploadTailsFile(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    agentContext: AgentContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    options: {
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
    }
  ): Promise<{ tailsFileUrl: string }> {
    //uploading to IPFS
    let cid: string | null = null
    try {
      const localTailsFilePath = options.revocationRegistryDefinition.value.tailsLocation

      // const tailsFileId = randomUUID() //probably don't need this anyway
      const data = new FormData()
      const readStream = fs.createReadStream(localTailsFilePath)
      data.append('file', readStream)
      // const response = await agentContext.config.agentDependencies.fetch(
      //   `${this.tailsServerBaseUrl}/${encodeURIComponent(tailsFileId)}`,
      //   {
      //     method: 'PUT',
      //     body: data,
      //   }
      // )
      cid = await this.ipfs.uploadFile(Buffer.from(JSON.stringify(readStream), 'utf8'))
    } catch (err) {
      agentContext.config.logger.error(
        `Failed to upload file to IPFS from location: ${options.revocationRegistryDefinition.value.tailsLocation}`
      )
      return {
        tailsFileUrl: 'ERROR',
      }
    }
    return {
      tailsFileUrl: cid,
    }
  }

  public async getTailsFile<SomeObj>(
    agentContext: AgentContext,
    options: {
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
    }
  ) {
    const { revocationRegistryDefinition } = options
    const { tailsLocation, tailsHash } = revocationRegistryDefinition.value

    const fileSystem = agentContext.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)

    try {
      agentContext.config.logger.debug(
        `Checking to see if tails file for URL ${revocationRegistryDefinition.value.tailsLocation} has been stored in the FileSystem`
      )

      // hash is used as file identifier
      const tailsExists = await this.tailsFileExists(agentContext, tailsHash)
      const tailsFilePath = await this.getTailsFilePath(agentContext, tailsHash)
      agentContext.config.logger.debug(
        `Tails file for ${tailsLocation} ${tailsExists ? 'is stored' : 'is not stored'} at ${tailsFilePath}`
      )

      if (!tailsExists) {
        agentContext.config.logger.debug(`Retrieving tails file from IPFS ${tailsLocation}`)
        //download file from ipfs
        let fileBuffer: Buffer | null = null

        fileBuffer = await this.ipfs.getFile(tailsHash) //would the cid be the tails hash??
        const resultText = fileBuffer.toString('utf8')
        let result: SomeObj | null = null
        try {
          result = JSON.parse(resultText) as SomeObj
        } catch (err) {
          agentContext.config.logger.error(`Failed to parse content of ${tailsHash}`, {
            tailsHash,
            schemaText: resultText,
          })
        }
        // download file and verify hash
        // await fileSystem.downloadToFile(tailsLocation, tailsFilePath, {
        //   verifyHash: {
        //     algorithm: 'sha256',
        //     hash: TypedArrayEncoder.fromBase58(tailsHash),
        //   },
        // })
        agentContext.config.logger.debug(`Saved tails file to FileSystem at path ${tailsFilePath}`)
      }

      return { tailsFilePath }
    } catch (error) {
      agentContext.config.logger.error(`Error while retrieving tails file from URL ${tailsLocation}`, {
        error,
      })
      throw error
    }
  }

  protected async getTailsFilePath(agentContext: AgentContext, tailsHash: string) {
    return `${await this.getTailsBasePath(agentContext)}/${tailsHash}`
  }

  protected async tailsFileExists(agentContext: AgentContext, tailsHash: string): Promise<boolean> {
    const fileSystem = agentContext.dependencyManager.resolve<FileSystem>(InjectionSymbols.FileSystem)
    const tailsFilePath = await this.getTailsFilePath(agentContext, tailsHash)
    return await fileSystem.exists(tailsFilePath)
  }
}

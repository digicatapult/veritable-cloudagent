import { VerifiedDrpcModuleConfig } from '../../VerifiedDrpcModuleConfig.js'

export const withVerifiedDrpcModuleConfig = () => {
  return new VerifiedDrpcModuleConfig({ proofRequestOptions: { protocolVersion: '2.0', proofFormats: {} } })
}
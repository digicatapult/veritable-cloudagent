interface ParsedRevocationRegistryId {
  did: string
  namespaceIdentifier: string
  schemaSeqNo: string
  credentialDefinitionTag: string
  revocationRegistryTag: string
  namespace?: string
}
export default class VeritableIdentifiers {
  // TZQuLp43UcYTdtc3HewcDz:4:TZQuLp43UcYTdtc3HewcDz:3:CL:98158:BaustellenzertifikateNU1:CL_ACCUM:1-100
  public async getUnqualifiedRevocationRegistryDefinitionId(
    unqualifiedDid: string,
    schemaSeqNo: string | number,
    credentialDefinitionTag: string,
    revocationRegistryTag: string
  ) {
    return `${unqualifiedDid}:4:${unqualifiedDid}:3:CL:${schemaSeqNo}:${credentialDefinitionTag}:CL_ACCUM:${revocationRegistryTag}`
  }

  public async parseDid(did: string, supportedIdentifier: RegExp) {
    const match = did.match(supportedIdentifier)
    if (match) {
      const [, namespace, namespaceIdentifier] = match
      return { namespace, namespaceIdentifier }
    } else {
      throw new Error(`${did} is not a valid did:key or did:web did`)
    }
  }

  public async parseRevocationRegistryId(
    revocationRegistryId: string,
    ipfsIdentifier: RegExp
  ): Promise<ParsedRevocationRegistryId> {
    const didIndyMatch = revocationRegistryId.match(ipfsIdentifier) //should this be matching sth else than below?
    if (didIndyMatch) {
      const [, did, namespace, namespaceIdentifier, schemaSeqNo, credentialDefinitionTag, revocationRegistryTag] =
        didIndyMatch

      return {
        did,
        namespaceIdentifier,
        schemaSeqNo,
        credentialDefinitionTag,
        revocationRegistryTag,
        namespace,
      }
    }

    const legacyMatch = revocationRegistryId.match(ipfsIdentifier) //should this be asth else than above?
    if (legacyMatch) {
      const [, did, schemaSeqNo, credentialDefinitionTag, revocationRegistryTag] = legacyMatch

      return {
        did,
        namespaceIdentifier: did,
        schemaSeqNo,
        credentialDefinitionTag,
        revocationRegistryTag,
      }
    }

    throw new Error(`Invalid revocation registry id: ${revocationRegistryId}`)
  }
}

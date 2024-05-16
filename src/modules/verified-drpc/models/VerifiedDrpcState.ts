export enum VerifiedDrpcState {
  // Client states
  RecipientProofRequestSent = 'recipient-proof-request-sent',
  RequestSent = 'request-sent',

  // Server states
  RecipientProofRequestReceived = 'recipient-proof-request-received',
  RecipientProofSent = 'recipient-proof-sent',
  RequestReceived = 'request-received',
  
  // Common states
  Abandoned = 'abandoned',
  Completed = 'completed',
}

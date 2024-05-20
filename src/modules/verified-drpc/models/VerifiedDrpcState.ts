export enum VerifiedDrpcState {
  // Client states
  ServerProofRequestSent = 'server-proof-request-sent',
  RequestSent = 'request-sent',

  // Server states
  RequestReceived = 'request-received',
  ClientProofReceived = 'client-proof-received',
  
  // Common states
  Abandoned = 'abandoned',
  Completed = 'completed',
}

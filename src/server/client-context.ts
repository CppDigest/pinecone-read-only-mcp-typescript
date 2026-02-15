import { PineconeClient } from '../pinecone-client.js';

// Global Pinecone client (initialized lazily)
let pineconeClient: PineconeClient | null = null;

export function getPineconeClient(): PineconeClient {
  if (!pineconeClient) {
    throw new Error('Pinecone client not initialized. Call setPineconeClient first.');
  }
  return pineconeClient;
}

export function setPineconeClient(client: PineconeClient): void {
  pineconeClient = client;
}

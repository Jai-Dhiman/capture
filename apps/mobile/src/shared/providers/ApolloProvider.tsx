import { ApolloProvider as BaseApolloProvider } from '@apollo/client';
import { apolloClient } from '../lib/apollo';
import type React from 'react';

export function ApolloProvider({ children }: { children: React.ReactNode }) {
  return <BaseApolloProvider client={apolloClient}>{children}</BaseApolloProvider>;
}

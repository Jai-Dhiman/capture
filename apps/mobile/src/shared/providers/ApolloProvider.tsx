import { ApolloProvider as BaseApolloProvider } from '@apollo/client';
import { apolloClient } from '../lib/apollo';

export function ApolloProvider({ children }: { children: React.ReactNode }) {
  return <BaseApolloProvider client={apolloClient}>{children}</BaseApolloProvider>;
}

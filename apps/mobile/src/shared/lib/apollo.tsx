import { useAuthStore } from '@/features/auth/stores/authStore';
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
import { API_URL } from '@env';
import Constants from 'expo-constants';

// Fallback for production builds where @env might not work
const apiUrl = API_URL || Constants.expoConfig?.extra?.API_URL || 'https://capture-api.jai-d.workers.dev';

const httpLink = createHttpLink({
  uri: `${apiUrl}/graphql`,
});

const authLink = setContext(async (_, { headers }) => {
  const { session, refreshSession } = useAuthStore.getState();
  let token = session?.access_token;

  // Check if token needs refresh (expires within 5 minutes)
  if (token && session?.expires_at) {
    const isExpiringSoon = session.expires_at - Date.now() < 5 * 60 * 1000;
    if (isExpiringSoon) {
      try {
        const refreshedSession = await refreshSession();
        token = refreshedSession?.access_token || token;
      } catch (error) {
        console.warn('Token refresh failed in Apollo client:', error);
      }
    }
  }

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(`GraphQL error: Message: ${message}, Location: ${locations}, Path: ${path}`);
    });
  }

  if (networkError) {
    console.error(`Network error: ${networkError.message}`);

    // If unauthorized, try to refresh token and retry
    if (networkError.message.includes('401') || networkError.message.includes('Unauthorized')) {
      const { refreshSession } = useAuthStore.getState();
      return refreshSession()
        .then(() => {
          return forward(operation);
        })
        .catch(() => {
          // If refresh fails, redirect to login or handle appropriately
          console.error('Token refresh failed, user needs to re-authenticate');
        });
    }
  }
});

// Retry link for network failures
const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: Number.POSITIVE_INFINITY,
    jitter: true,
  },
  attempts: {
    max: 3,
    retryIf: (error, _operation) => !!error && !error.message.includes('401'),
  },
});

export const apolloClient = new ApolloClient({
  link: errorLink.concat(retryLink.concat(authLink.concat(httpLink))),
  cache: new InMemoryCache(),
});

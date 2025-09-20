import React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';

jest.mock('@/shared/lib/apiClient', () => {
  return {
    getCDNImageUrl: jest.fn(),
    getImageUrl: jest.fn(),
  };
});

const { getCDNImageUrl, getImageUrl } = jest.requireMock('@/shared/lib/apiClient');

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function TestComp({ id, useCDN = true }: { id: string; useCDN?: boolean }) {
  const { useImageUrl } = require('./useMedia');
  const q = useImageUrl({ id }, 'medium', useCDN);
  return <>{q.data ? <Text testID="url">{q.data}</Text> : <Text testID="pending">pending</Text>}</>;
}

describe('useImageUrl', () => {
  it('returns CDN url when available', async () => {
    (getCDNImageUrl as jest.Mock).mockResolvedValueOnce('https://cdn/url');
    const { getByTestId } = render(
      <Wrapper>
        <TestComp id="abc" />
      </Wrapper>,
    );

    await waitFor(() => expect(getByTestId('url').props.children).toBe('https://cdn/url'));
  });

  it('returns null when CDN reports missing image', async () => {
    (getCDNImageUrl as jest.Mock).mockResolvedValueOnce(null);
    const { getByTestId } = render(
      <Wrapper>
        <TestComp id="missing" />
      </Wrapper>,
    );

    await waitFor(() => expect(getByTestId('pending')).toBeTruthy());
  });

  it('falls back to direct URL when useCDN is false', async () => {
    (getImageUrl as jest.Mock).mockResolvedValueOnce('https://direct/url');
    const { getByTestId } = render(
      <Wrapper>
        <TestComp id="abc" useCDN={false} />
      </Wrapper>,
    );

    await waitFor(() => expect(getByTestId('url').props.children).toBe('https://direct/url'));
  });
});

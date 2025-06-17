import { vi } from 'vitest';
import { mockCreateD1Client } from '../mocks/db-mock'; // Adjusted path

vi.mock('@/db', () => {
  return {
    createD1Client: mockCreateD1Client,
  };
});

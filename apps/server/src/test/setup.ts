import { vi } from 'vitest';
import { mockCreateD1Client } from './mocks/db-mock';

vi.mock('../db', () => ({
  createD1Client: () => mockCreateD1Client(),
}));

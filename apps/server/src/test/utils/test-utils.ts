import { Bindings } from '../../types'
import { nanoid } from 'nanoid'
import { vi } from 'vitest'
import type { R2Bucket } from '@cloudflare/workers-types'

export function createMockBindings(): Bindings {
  const bindings = {
    DB: {
      prepare: vi.fn(),
      execute: vi.fn(),
      exec: vi.fn(),
      batch: vi.fn(),
      createStatement: vi.fn(),
      dump: vi.fn(),
      _name: 'test-db',
    } as any,
    BUCKET: {
      put: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({
        body: new ReadableStream(),
        headers: new Headers({ 'content-type': 'image/jpeg' }),
      }),
      delete: vi.fn().mockResolvedValue(undefined),
      head: vi.fn().mockResolvedValue(null),
      createMultipartUpload: vi.fn().mockResolvedValue({
        uploadId: 'test-upload-id',
        key: 'test-key',
      }),
      resumeMultipartUpload: vi.fn().mockResolvedValue({
        uploadId: 'test-upload-id',
        key: 'test-key',
      }),
      list: vi.fn().mockResolvedValue({
        objects: [],
        truncated: false,
      }),
    } as R2Bucket,
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_KEY: 'test-key',
  }
  return bindings
}

export function createTestFile(
  options: {
    name?: string
    type?: string
    size?: number
  } = {}
) {
  const content = options.size ? new Uint8Array(options.size).fill(65) : 'test-content'

  return new File([content], options.name || `test-${nanoid()}.jpg`, {
    type: options.type || 'image/jpeg',
  })
}

export function createFormData(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return formData
}

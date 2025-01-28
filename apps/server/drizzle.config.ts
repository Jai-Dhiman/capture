import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: 'postgresql://capture-db_owner:npg_mRF5EWhdA4aL@ep-small-fog-a5clvi8p-pooler.us-east-2.aws.neon.tech/capture-db?sslmode=require',
  },
})

import { seedFeedbackData } from '../src/db/seed-feedback';

// Mock environment for local seeding
// Derive the expected Env type from the seed function signature.
type SeedEnv = Parameters<typeof seedFeedbackData>[0];
const env: SeedEnv = {
  // Use globalThis for portability; cast if you haven't declared it in ambient types.
  DB: (globalThis as any).DB, // Ensure this is initialized before running the script
};

async function main() {
  try {
    console.log('Starting feedback data seeding...');
    await seedFeedbackData(env);
    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

main();
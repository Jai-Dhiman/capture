import { nanoid } from 'nanoid';
import { createD1Client } from './index';
import * as schema from './schema';

export async function seedFeedbackData(env: any) {
  const db = createD1Client(env);
  
  console.log('Seeding feedback data...');

  // Check if categories already exist
  const existingCategories = await db
    .select()
    .from(schema.feedbackCategory)
    .all();

  if (existingCategories.length > 0) {
    console.log('Feedback categories already exist, skipping seed.');
    return;
  }

  // Create feedback categories
  const categories = [
    {
      id: nanoid(),
      name: 'Bug Report',
      description: 'Report issues, crashes, or unexpected behavior',
      priorityLevel: 3,
      isActive: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: nanoid(),
      name: 'Feature Request',
      description: 'Suggest new features or improvements',
      priorityLevel: 2,
      isActive: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: nanoid(),
      name: 'General Feedback',
      description: 'Share your thoughts and general feedback',
      priorityLevel: 1,
      isActive: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: nanoid(),
      name: 'Technical Support',
      description: 'Get help with technical issues',
      priorityLevel: 2,
      isActive: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: nanoid(),
      name: 'Account & Billing',
      description: 'Questions about your account or billing',
      priorityLevel: 2,
      isActive: 1,
      createdAt: new Date().toISOString(),
    },
  ];

  for (const category of categories) {
    await db.insert(schema.feedbackCategory).values(category);
  }

  console.log(`Created ${categories.length} feedback categories.`);

  // Check if we have any users to create sample tickets
  const users = await db
    .select()
    .from(schema.users)
    .limit(3)
    .all();

  if (users.length === 0) {
    console.log('No users found, skipping sample ticket creation.');
    return;
  }

  // Create some sample tickets for demonstration
  const sampleTickets = [
    {
      id: nanoid(),
      userId: users[0].id,
      categoryId: categories[0].id, // Bug Report
      subject: 'App crashes when uploading large images',
      description: 'The app consistently crashes when I try to upload images larger than 10MB. This happens on both WiFi and cellular networks.',
      priority: 'high',
      type: 'bug_report',
      status: 'open',
      deviceInfo: JSON.stringify({
        platform: 'iOS 17.2',
        deviceModel: 'iPhone 15 Pro',
        appVersion: '1.2.3',
        osVersion: '17.2.1'
      }),
      appVersion: '1.2.3',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: nanoid(),
      userId: users[1] ? users[1].id : users[0].id,
      categoryId: categories[1].id, // Feature Request
      subject: 'Add dark mode to the app',
      description: 'Would love to see a dark mode option in the app settings. The current bright theme is hard on the eyes during evening use.',
      priority: 'medium',
      type: 'feature_request',
      status: 'open',
      deviceInfo: JSON.stringify({
        platform: 'Android 14',
        deviceModel: 'Samsung Galaxy S24',
        appVersion: '1.2.3',
        osVersion: '14.0'
      }),
      appVersion: '1.2.3',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: nanoid(),
      userId: users[2] ? users[2].id : users[0].id,
      categoryId: categories[2].id, // General Feedback
      subject: 'Love the new update!',
      description: 'The latest update is fantastic! The new UI is much cleaner and the performance improvements are noticeable.',
      priority: 'low',
      type: 'feedback',
      status: 'resolved',
      deviceInfo: JSON.stringify({
        platform: 'iOS 17.1',
        deviceModel: 'iPhone 14',
        appVersion: '1.2.3',
        osVersion: '17.1.0'
      }),
      appVersion: '1.2.3',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  for (const ticket of sampleTickets) {
    await db.insert(schema.feedbackTicket).values(ticket);
  }

  console.log(`Created ${sampleTickets.length} sample tickets.`);

  // Add some sample responses
  const sampleResponses = [
    {
      id: nanoid(),
      ticketId: sampleTickets[0].id,
      responderId: users[0].id,
      responderType: 'admin',
      message: 'Thank you for reporting this issue. We are investigating the problem with large image uploads and will have a fix in the next release.',
      isInternal: 0,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: nanoid(),
      ticketId: sampleTickets[2].id,
      responderId: users[0].id,
      responderType: 'admin',
      message: 'Thank you for the positive feedback! We are glad you are enjoying the new update.',
      isInternal: 0,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  for (const response of sampleResponses) {
    await db.insert(schema.feedbackResponse).values(response);
  }

  console.log(`Created ${sampleResponses.length} sample responses.`);
  console.log('Feedback data seeding completed!');
}
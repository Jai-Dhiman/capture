import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../test/setup";
import { createGraphQLTestClient } from "../../test/utils/graphql-test-client";

describe("Profile GraphQL Operations", () => {
  let client: any;

  beforeEach(() => {
    client = createGraphQLTestClient();
  });

  afterEach(async () => {
    // Clean up resources after each test
    if (client && client.cleanup) {
      await client.cleanup();
    }
  });

  it("should fetch a profile by userId", async () => {
    const PROFILE_QUERY = `
      query GetProfile($id: ID!) {
        profile(id: $id) {
          id
          userId
          username
          bio
          isPrivate
        }
      }
    `;

    const result = await client.query(PROFILE_QUERY, {
      variables: { id: "test-user-id" },
    });

    // Log the result for debugging
    console.log('Profile query result:', JSON.stringify(result, null, 2));

    // Check for no errors
    expect(result.errors).toBeUndefined();

    // Verify the data structure
    expect(result.data.profile).toMatchObject({
      userId: "test-user-id",
      username: "testuser",
      bio: "Test bio",
      isPrivate: false,
    });
  });

  it("should update a profile", async () => {
    const UPDATE_PROFILE_MUTATION = `
      mutation UpdateProfile($input: ProfileInput!) {
        updateProfile(input: $input) {
          id
          userId
          username
          bio
          isPrivate
        }
      }
    `;

    const result = await client.mutate(UPDATE_PROFILE_MUTATION, {
      variables: {
        input: {
          username: "updateduser",
          bio: "Updated bio",
        },
      },
    });

    // Log the result for debugging
    console.log('Update profile result:', JSON.stringify(result, null, 2));

    expect(result.errors).toBeUndefined();
    expect(result.data.updateProfile).toMatchObject({
      userId: "test-user-id",
      username: "updateduser",
      bio: "Updated bio",
    });
  });

  it("should update privacy settings", async () => {
    const UPDATE_PRIVACY_MUTATION = `
      mutation UpdatePrivacy($isPrivate: Boolean!) {
        updatePrivacySettings(isPrivate: $isPrivate) {
          id
          userId
          username
          isPrivate
        }
      }
    `;

    const result = await client.mutate(UPDATE_PRIVACY_MUTATION, {
      variables: {
        isPrivate: true,
      },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data.updatePrivacySettings).toMatchObject({
      userId: "test-user-id",
      isPrivate: true,
    });
  });
});

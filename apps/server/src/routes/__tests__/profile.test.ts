import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import profileRouter from "../profile";
import { authMiddleware } from "../../middleware/auth";
import { createMockBindings } from "../../test/utils/test-utils";
import type { Bindings, Variables, AppUser } from "../../types";
import { profile } from "../../db/schema";

// Mock drizzle functions
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockGet = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockDelete = vi.fn();

// Mock the drizzle module
vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete,
  })),
}));

// Set up the mock select chain
mockSelect.mockReturnValue({ from: mockFrom });
mockFrom.mockReturnValue({ where: mockWhere });
mockWhere.mockReturnValue({ get: mockGet });

// Set up the mock insert chain
mockInsert.mockReturnValue({ values: mockValues });
mockValues.mockResolvedValue(undefined);

// Set up the mock delete chain
mockDelete.mockReturnValue({ where: mockWhere });

describe("Profile Routes", () => {
  let app: Hono<{ Bindings: Bindings; Variables: Variables }>;
  let mockBindings: Bindings;
  const mockUser = { id: "test-user-id", email: "test@example.com" };
  let authToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockBindings = createMockBindings();
    mockBindings.JWT_SECRET = "test-secret";

    authToken = await sign({ sub: mockUser.id, email: mockUser.email, exp: Math.floor(Date.now() / 1000) + (60 * 60) }, mockBindings.JWT_SECRET);

    app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

    app.use("*", async (c, next) => {
      c.env = mockBindings;
      await next();
    });

    app.use("/profile/*", authMiddleware);

    app.route("/profile", profileRouter);
  });

  describe("GET /check-username", () => {
    it("should return available=true when username is not taken", async () => {
      // Setup
      mockGet.mockResolvedValue(null);

      // Execute
      const res = await app.request("/profile/check-username?username=available_username");

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json() as { available: boolean };
      expect(data).toEqual({ available: true });
      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith(profile);
      expect(mockWhere).toHaveBeenCalled();
    });

    it("should return available=false when username is already taken", async () => {
      // Setup
      mockGet.mockResolvedValue({
        id: "existing-profile-id",
        username: "taken_username",
      });

      // Execute
      const res = await app.request("/profile/check-username?username=taken_username");

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json() as { available: boolean };
      expect(data).toEqual({ available: false });
    });

    it("should return 400 when username is not provided", async () => {
      // Execute
      const res = await app.request("/profile/check-username");

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json() as { available: boolean; message: string };
      expect(data).toEqual({ available: false, message: "Username is required" });
      expect(mockSelect).not.toHaveBeenCalled();
    });
  });

  describe("POST /", () => {
    it("should create a profile successfully", async () => {
      // Setup
      mockGet.mockResolvedValue(null); // Username not taken
      const profileData = {
        userId: "test-user-id",
        username: "testuser",
        bio: "Test bio",
        profileImage: "image-url",
      };

      // Execute
      const res = await app.request("/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify(profileData),
      });

      // Assert
      expect(res.status).toBe(201);
      const data = await res.json() as {
        id: string;
        userId: string;
        username: string;
        bio: string | null;
        profileImage: string | null;
        verifiedType: string;
        createdAt: string;
        updatedAt: string;
      };
      expect(data).toMatchObject({
        userId: "test-user-id",
        username: "testuser",
        bio: "Test bio",
        profileImage: "image-url",
        verifiedType: "none",
      });
      expect(data.id).toBeDefined();
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();
      expect(mockInsert).toHaveBeenCalledWith(profile);
      expect(mockValues).toHaveBeenCalled();
    });

    it("should create a profile with minimal data", async () => {
      // Setup
      mockGet.mockResolvedValue(null); // Username not taken
      const profileData = {
        userId: "test-user-id",
        username: "testuser",
      };

      // Execute
      const res = await app.request("/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify(profileData),
      });

      // Assert
      expect(res.status).toBe(201);
      const data = await res.json() as {
        id: string;
        userId: string;
        username: string;
        bio: string | null;
        profileImage: string | null;
        verifiedType: string;
        createdAt: string;
        updatedAt: string;
      };
      expect(data).toMatchObject({
        userId: "test-user-id",
        username: "testuser",
        bio: null,
        profileImage: null,
        verifiedType: "none",
      });
    });

    it("should return 400 when username is already taken", async () => {
      // Setup
      mockGet.mockResolvedValue({
        id: "existing-profile-id",
        username: "testuser",
      });
      const profileData = {
        userId: "test-user-id",
        username: "testuser",
      };

      // Execute
      const res = await app.request("/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify(profileData),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json() as { message: string };
      expect(data).toEqual({ message: "Username already taken" });
    });

    it("should return 403 when userId doesn't match authenticated user", async () => {
      // Setup
      const profileData = {
        userId: "different-user-id", // Different from authenticated user
        username: "testuser",
      };

      // Execute
      const res = await app.request("/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify(profileData),
      });

      // Assert
      expect(res.status).toBe(403);
      const data = await res.json() as { message: string };
      expect(data).toEqual({ message: "Unauthorized" });
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("should return 400 with validation errors for invalid input", async () => {
      // Setup
      const profileData = {
        userId: "test-user-id",
        username: "a", // Too short
      };

      // Execute
      const res = await app.request("/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify(profileData),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json() as { message: string; errors?: any };
      expect(data.message).toBe("Invalid input");
      expect(data.errors).toBeDefined();
    });

    it("should handle server errors during profile creation", async () => {
      // Setup
      mockGet.mockResolvedValue(null);
      mockValues.mockRejectedValue(new Error("Database error"));
      const profileData = {
        userId: "test-user-id",
        username: "testuser",
      };

      // Execute
      const res = await app.request("/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify(profileData),
      });

      // Assert
      expect(res.status).toBe(500);
      const data = await res.json() as { message: string };
      expect(data).toEqual({ message: "Failed to create profile" });
    });
  });

  describe("DELETE /:userId", () => {
    it("should delete profile successfully", async () => {
      // Setup
      mockGet.mockResolvedValue({
        id: "existing-profile-id",
        userId: "test-user-id",
      });

      // Execute
      const res = await app.request("/profile/test-user-id", {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json() as { message: string };
      expect(data).toEqual({ message: "Profile deleted successfully" });
      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith(profile);
      expect(mockWhere).toHaveBeenCalled();
      expect(mockDelete).toHaveBeenCalledWith(profile);
    });

    it("should return 403 when userId doesn't match authenticated user", async () => {
      // Execute
      const res = await app.request("/profile/different-user-id", {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });

      // Assert
      expect(res.status).toBe(403);
      const data = await res.json() as { message: string };
      expect(data).toEqual({ message: "Unauthorized" });
      expect(mockSelect).not.toHaveBeenCalled();
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("should return 404 when profile doesn't exist", async () => {
      // Setup
      mockGet.mockResolvedValue(null);

      // Execute
      const res = await app.request("/profile/test-user-id", {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });

      // Assert
      expect(res.status).toBe(404);
      const data = await res.json() as { message: string };
      expect(data).toEqual({ message: "Profile not found" });
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("should handle server errors during profile deletion", async () => {
      // Setup
      mockGet.mockResolvedValue({
        id: "existing-profile-id",
        userId: "test-user-id",
      });
      mockWhere.mockImplementation(() => {
        if (mockDelete.mock.calls.length > 0) {
          // Only throw error on delete operation
          throw new Error("Database error");
        }
        return { get: mockGet };
      });

      // Execute
      const res = await app.request("/profile/test-user-id", {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });

      // Assert
      expect(res.status).toBe(500);
      const data = await res.json() as { message: string };
      expect(data).toEqual({ message: "Failed to delete profile" });
    });
  });
});

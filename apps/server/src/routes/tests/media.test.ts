import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import mediaRouter from "../media";
import { createMockBindings } from "../../test/utils/test-utils";
import type { Bindings, Variables } from "../../types";

// Mock the image service functions
const mockGetUploadUrl = vi.fn();
const mockCreate = vi.fn();
const mockGetImageUrl = vi.fn();
const mockFindById = vi.fn();
const mockDelete = vi.fn();
const mockGetDirectCloudflareUrl = vi.fn();

// Mock the imageService module
vi.mock("../../lib/imageService", () => ({
  createImageService: vi.fn(() => ({
    getUploadUrl: mockGetUploadUrl,
    create: mockCreate,
    getImageUrl: mockGetImageUrl,
    findById: mockFindById,
    delete: mockDelete,
    getDirectCloudflareUrl: mockGetDirectCloudflareUrl,
  })),
}));

describe("Media Routes", () => {
  let app: Hono<{ Bindings: Bindings; Variables: Variables }>;
  let mockBindings: Bindings;
  const mockUser = { id: "test-user-id", email: "test@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockBindings = createMockBindings();

    app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

    // Set up environment and user in context
    app.use("*", async (c, next) => {
      c.env = mockBindings;
      c.set("user", mockUser as any);
      await next();
    });

    app.route("/media", mediaRouter);
  });

  describe("POST /image-upload", () => {
    it("should generate an upload URL successfully", async () => {
      // Setup
      const mockUploadData = {
        uploadURL: "https://example.com/upload",
        id: "test-image-id",
      };
      mockGetUploadUrl.mockResolvedValue(mockUploadData);

      // Execute
      const res = await app.request("/media/image-upload", {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(mockUploadData);
      expect(mockGetUploadUrl).toHaveBeenCalled();
    });

    it("should return 401 when user is not authenticated", async () => {
      // Setup - app without user
      const appWithoutUser = new Hono<{ Bindings: Bindings; Variables: Variables }>();
      appWithoutUser.use("*", async (c, next) => {
        c.env = mockBindings;
        await next();
      });
      appWithoutUser.route("/media", mediaRouter);

      // Execute
      const res = await appWithoutUser.request("/media/image-upload", {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toEqual({ error: "User not authenticated" });
      expect(mockGetUploadUrl).not.toHaveBeenCalled();
    });

    it("should handle errors when generating upload URL fails", async () => {
      // Setup
      mockGetUploadUrl.mockRejectedValue(new Error("Failed to generate URL"));

      // Execute
      const res = await app.request("/media/image-upload", {
        method: "POST",
      });

      // Assert
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data).toEqual({ error: "Failed to generate upload URL" });
    });
  });

  describe("POST /image-record", () => {
    it("should create a media record successfully", async () => {
      // Setup
      const mockMediaData = {
        id: "test-media-id",
        userId: mockUser.id,
        storageKey: "test-image-id",
        type: "image",
        order: 1,
        postId: "test-post-id",
        createdAt: new Date().toISOString(),
      };
      mockCreate.mockResolvedValue(mockMediaData);
      mockGetImageUrl.mockResolvedValue("https://example.com/image.jpg");

      // Execute
      const res = await app.request("/media/image-record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageId: "test-image-id",
          order: 1,
          postId: "test-post-id",
        }),
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        media: {
          ...mockMediaData,
          url: "https://example.com/image.jpg",
        },
      });
      expect(mockCreate).toHaveBeenCalledWith({
        userId: mockUser.id,
        imageId: "test-image-id",
        order: 1,
        postId: "test-post-id",
      });
      expect(mockGetImageUrl).toHaveBeenCalledWith(mockMediaData.storageKey, "public", 300);
    });

    it("should return 401 when user is not authenticated", async () => {
      // Setup - app without user
      const appWithoutUser = new Hono<{ Bindings: Bindings; Variables: Variables }>();
      appWithoutUser.use("*", async (c, next) => {
        c.env = mockBindings;
        await next();
      });
      appWithoutUser.route("/media", mediaRouter);

      // Execute
      const res = await appWithoutUser.request("/media/image-record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageId: "test-image-id",
        }),
      });

      // Assert
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toEqual({ error: "User not authenticated" });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should return 400 when imageId is missing", async () => {
      // Execute
      const res = await app.request("/media/image-record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order: 1,
          postId: "test-post-id",
        }),
      });

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toEqual({ error: "Image ID is required" });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should handle errors when creating media record fails", async () => {
      // Setup
      mockCreate.mockRejectedValue(new Error("Database error"));

      // Execute
      const res = await app.request("/media/image-record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageId: "test-image-id",
          order: 1,
          postId: "test-post-id",
        }),
      });

      // Assert
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data).toEqual({ error: "Failed to create media record" });
    });
  });

  describe("GET /:mediaId/url", () => {
    it("should return the image URL successfully", async () => {
      // Setup
      const mockMediaData = {
        id: "test-media-id",
        userId: mockUser.id,
        storageKey: "test-storage-key",
        type: "image",
      };
      mockFindById.mockResolvedValue(mockMediaData);
      mockGetImageUrl.mockResolvedValue("https://example.com/image.jpg");

      // Execute
      const res = await app.request("/media/test-media-id/url", {
        method: "GET",
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ url: "https://example.com/image.jpg" });
      expect(mockFindById).toHaveBeenCalledWith("test-media-id", mockUser.id);
      expect(mockGetImageUrl).toHaveBeenCalledWith(mockMediaData.storageKey, "public", 1800);
    });

    it("should respect custom expiry parameter", async () => {
      // Setup
      const mockMediaData = {
        id: "test-media-id",
        userId: mockUser.id,
        storageKey: "test-storage-key",
        type: "image",
      };
      mockFindById.mockResolvedValue(mockMediaData);
      mockGetImageUrl.mockResolvedValue("https://example.com/image.jpg");

      // Execute
      const res = await app.request("/media/test-media-id/url?expiry=3600", {
        method: "GET",
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ url: "https://example.com/image.jpg" });
      expect(mockGetImageUrl).toHaveBeenCalledWith(mockMediaData.storageKey, "public", 3600);
    });

    it("should cap expiry at maximum allowed value", async () => {
      // Setup
      const mockMediaData = {
        id: "test-media-id",
        userId: mockUser.id,
        storageKey: "test-storage-key",
        type: "image",
      };
      mockFindById.mockResolvedValue(mockMediaData);
      mockGetImageUrl.mockResolvedValue("https://example.com/image.jpg");

      // Execute - requesting expiry higher than max (86400)
      const res = await app.request("/media/test-media-id/url?expiry=100000", {
        method: "GET",
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ url: "https://example.com/image.jpg" });
      expect(mockGetImageUrl).toHaveBeenCalledWith(mockMediaData.storageKey, "public", 86400);
    });

    it("should return 404 when media is not found", async () => {
      // Setup
      mockFindById.mockResolvedValue(null);

      // Execute
      const res = await app.request("/media/test-media-id/url", {
        method: "GET",
      });

      // Assert
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toEqual({ error: "Media not found" });
      expect(mockGetImageUrl).not.toHaveBeenCalled();
    });

    it("should handle errors when getting image URL fails", async () => {
      // Setup
      const mockMediaData = {
        id: "test-media-id",
        userId: mockUser.id,
        storageKey: "test-storage-key",
        type: "image",
      };
      mockFindById.mockResolvedValue(mockMediaData);
      mockGetImageUrl.mockRejectedValue(new Error("Failed to generate URL"));

      // Execute
      const res = await app.request("/media/test-media-id/url", {
        method: "GET",
      });

      // Assert
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data).toEqual({ error: "Failed to get image URL" });
    });
  });

  describe("DELETE /:mediaId", () => {
    it("should delete media successfully", async () => {
      // Setup
      mockDelete.mockResolvedValue(undefined);

      // Execute
      const res = await app.request("/media/test-media-id", {
        method: "DELETE",
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true });
      expect(mockDelete).toHaveBeenCalledWith("test-media-id", mockUser.id);
    });

    it("should handle errors when deleting media fails", async () => {
      // Setup
      mockDelete.mockRejectedValue(new Error("Delete failed"));

      // Execute
      const res = await app.request("/media/test-media-id", {
        method: "DELETE",
      });

      // Assert
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data).toEqual({ error: "Delete failed" });
    });
  });

  describe("GET /cloudflare-url/:cloudflareId", () => {
    it("should return direct Cloudflare URL successfully", async () => {
      // Setup
      mockGetDirectCloudflareUrl.mockResolvedValue("https://example.com/cloudflare-image.jpg");

      // Execute
      const res = await app.request("/media/cloudflare-url/test-cloudflare-id", {
        method: "GET",
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ url: "https://example.com/cloudflare-image.jpg" });
      expect(mockGetDirectCloudflareUrl).toHaveBeenCalledWith("test-cloudflare-id", "public", 1800);
    });

    it("should respect custom expiry parameter", async () => {
      // Setup
      mockGetDirectCloudflareUrl.mockResolvedValue("https://example.com/cloudflare-image.jpg");

      // Execute
      const res = await app.request("/media/cloudflare-url/test-cloudflare-id?expiry=3600", {
        method: "GET",
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ url: "https://example.com/cloudflare-image.jpg" });
      expect(mockGetDirectCloudflareUrl).toHaveBeenCalledWith("test-cloudflare-id", "public", 3600);
    });

    it("should cap expiry at maximum allowed value", async () => {
      // Setup
      mockGetDirectCloudflareUrl.mockResolvedValue("https://example.com/cloudflare-image.jpg");

      // Execute - requesting expiry higher than max (86400)
      const res = await app.request("/media/cloudflare-url/test-cloudflare-id?expiry=100000", {
        method: "GET",
      });

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ url: "https://example.com/cloudflare-image.jpg" });
      expect(mockGetDirectCloudflareUrl).toHaveBeenCalledWith("test-cloudflare-id", "public", 86400);
    });

    it("should handle errors when getting Cloudflare URL fails", async () => {
      // Setup
      mockGetDirectCloudflareUrl.mockRejectedValue(new Error("Failed to generate URL"));

      // Execute
      const res = await app.request("/media/cloudflare-url/test-cloudflare-id", {
        method: "GET",
      });

      // Assert
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data).toEqual({ error: "Failed to get image URL" });
    });
  });
});

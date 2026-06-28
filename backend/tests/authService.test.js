import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import { createAuthService } from "../src/services/authService.js";

const options = {
  jwtSecret: "service-test-secret",
  jwtExpiresIn: "1h",
};

describe("auth service", () => {
  it("hashes passwords and issues a JWT on registration", async () => {
    const User = {
      findOne: vi.fn(async () => null),
      create: vi.fn(async (data) => ({
        id: "user-1",
        name: data.name,
        email: data.email,
        password: data.password,
      })),
    };
    const service = createAuthService(User, options);
    const result = await service.register({
      name: "  Lan Nguyen  ",
      email: "LAN@example.com",
      password: "password123",
    });

    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Lan Nguyen", email: "lan@example.com" }),
    );
    const storedPassword = User.create.mock.calls[0][0].password;
    expect(storedPassword).not.toBe("password123");
    expect(await bcrypt.compare("password123", storedPassword)).toBe(true);
    expect(jwt.verify(result.token, options.jwtSecret).sub).toBe("user-1");
  });

  it("rejects duplicate registration", async () => {
    const User = {
      findOne: vi.fn(async () => ({ id: "existing" })),
      create: vi.fn(),
    };
    const service = createAuthService(User, options);

    await expect(
      service.register({
        name: "Lan",
        email: "lan@example.com",
        password: "password123",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("authenticates valid credentials and rejects invalid credentials", async () => {
    const password = await bcrypt.hash("password123", 4);
    const query = {
      select: vi.fn(async () => ({
        id: "user-1",
        name: "Lan",
        email: "lan@example.com",
        password,
      })),
    };
    const User = { findOne: vi.fn(() => query) };
    const service = createAuthService(User, options);

    const result = await service.login({
      email: "LAN@example.com",
      password: "password123",
    });
    expect(result.user.email).toBe("lan@example.com");

    await expect(
      service.login({ email: "lan@example.com", password: "wrong-password" }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

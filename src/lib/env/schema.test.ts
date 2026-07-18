import { describe, expect, it } from "vitest";

import { EnvValidationError, parseServerEnv } from "./schema";

function validEnv(): Record<string, string> {
  return {
    NODE_ENV: "development",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    APP_ENV: "development",
    ADMIN_EMAIL: "owner@example.com",
    CF_ACCESS_TEAM_DOMAIN: "team-name.cloudflareaccess.com",
    CF_ACCESS_AUDS: "aud-admin-page,aud-admin-api",
    DEV_ADMIN_BYPASS: "false",
    R2_ACCOUNT_ID: "account-id",
    R2_ACCESS_KEY_ID: "access-key-id",
    R2_SECRET_ACCESS_KEY: "secret-access-key",
    R2_PRIVATE_BUCKET: "portflow-showcase-private",
    R2_PUBLIC_BUCKET: "portflow-showcase-public",
    R2_PUBLIC_BASE_URL: "https://assets.example.com",
    UPLOAD_TOKEN_SECRET: "0123456789abcdef0123456789abcdef",
  };
}

describe("parseServerEnv", () => {
  it("parses a valid environment", () => {
    const env = parseServerEnv(validEnv());

    expect(env.ADMIN_EMAIL).toBe("owner@example.com");
    expect(env.APP_ENV).toBe("development");
    expect(env.DEV_ADMIN_BYPASS).toBe(false);
  });

  it("normalizes ADMIN_EMAIL with trim and lowercase", () => {
    const env = parseServerEnv({
      ...validEnv(),
      ADMIN_EMAIL: "  Owner@Example.COM ",
    });

    expect(env.ADMIN_EMAIL).toBe("owner@example.com");
  });

  it("parses CF_ACCESS_AUDS into a set of trimmed audience tags", () => {
    const env = parseServerEnv({
      ...validEnv(),
      CF_ACCESS_AUDS: " aud-one , aud-two ,, ",
    });

    expect(env.CF_ACCESS_AUDS).toEqual(new Set(["aud-one", "aud-two"]));
  });

  it("rejects an empty CF_ACCESS_AUDS", () => {
    expect(() =>
      parseServerEnv({ ...validEnv(), CF_ACCESS_AUDS: " , " }),
    ).toThrowError(EnvValidationError);
  });

  it("rejects a missing required variable", () => {
    const env = validEnv();
    delete env.R2_SECRET_ACCESS_KEY;

    expect(() => parseServerEnv(env)).toThrowError(EnvValidationError);
  });

  it("rejects an invalid ADMIN_EMAIL", () => {
    expect(() =>
      parseServerEnv({ ...validEnv(), ADMIN_EMAIL: "not-an-email" }),
    ).toThrowError(EnvValidationError);
  });

  it("rejects a short UPLOAD_TOKEN_SECRET", () => {
    expect(() =>
      parseServerEnv({ ...validEnv(), UPLOAD_TOKEN_SECRET: "too-short" }),
    ).toThrowError(EnvValidationError);
  });

  it("allows DEV_ADMIN_BYPASS=true only in local development", () => {
    const env = parseServerEnv({ ...validEnv(), DEV_ADMIN_BYPASS: "true" });

    expect(env.DEV_ADMIN_BYPASS).toBe(true);
  });

  it("rejects DEV_ADMIN_BYPASS=true when NODE_ENV is production", () => {
    expect(() =>
      parseServerEnv({
        ...validEnv(),
        NODE_ENV: "production",
        DEV_ADMIN_BYPASS: "true",
      }),
    ).toThrowError(EnvValidationError);
  });

  it("rejects DEV_ADMIN_BYPASS=true when APP_ENV is preview", () => {
    expect(() =>
      parseServerEnv({
        ...validEnv(),
        APP_ENV: "preview",
        DEV_ADMIN_BYPASS: "true",
      }),
    ).toThrowError(EnvValidationError);
  });

  it("does not leak variable values in the error message", () => {
    let caught: unknown;

    try {
      parseServerEnv({
        ...validEnv(),
        R2_SECRET_ACCESS_KEY: "",
        UPLOAD_TOKEN_SECRET: "super-secret-but-too-short",
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(EnvValidationError);
    const message = (caught as EnvValidationError).message;
    expect(message).toContain("UPLOAD_TOKEN_SECRET");
    expect(message).not.toContain("super-secret-but-too-short");
  });
});

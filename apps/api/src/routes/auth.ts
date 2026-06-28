import { FastifyInstance } from "fastify";
import {
  authLoginSchema,
  authRegisterSchema,
  authVerifyEmailSchema,
  passwordResetRequestSchema,
  passwordResetSchema
} from "@pulacash/shared";
import { authRateLimit } from "../lib/rate-limit.js";
import { authTokenFromRequest, requireUser } from "../lib/auth.js";
import { parseBody } from "../lib/validation.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/email.js";
import { PulaCashRepository } from "../services/repository.js";

export async function authRoutes(app: FastifyInstance, repository: PulaCashRepository) {
  app.post("/auth/register", authRateLimit, async (request) => {
    const input = parseBody(authRegisterSchema, request.body);
    const result = await repository.register(input);
    const { devCode } = await sendVerificationEmail(result.user.email, result.verificationCode, request.log);
    request.log.info({ userId: result.user.id }, "student registered");
    return {
      token: result.token,
      user: result.user,
      message: "Verification email sent.",
      // Only present outside production so dev/simulator can auto-fill the code.
      demoVerificationCode: devCode
    };
  });

  app.post("/auth/verify-email", authRateLimit, async (request) => {
    const input = parseBody(authVerifyEmailSchema, request.body);
    return repository.verifyEmail(input.email, input.code);
  });

  app.post("/auth/resend-verification", authRateLimit, async (request) => {
    const user = requireUser(request, repository);
    const code = repository.resendVerification(user);
    const { devCode } = await sendVerificationEmail(user.email, code, request.log);
    return { message: "Verification email sent.", demoVerificationCode: devCode };
  });

  app.post("/auth/login", authRateLimit, async (request) => {
    const input = parseBody(authLoginSchema, request.body);
    return repository.login(input.email, input.password);
  });

  app.post("/auth/request-password-reset", authRateLimit, async (request) => {
    const input = parseBody(passwordResetRequestSchema, request.body);
    const result = repository.requestPasswordReset(input.email);
    let devCode: string | undefined;
    if (result) {
      ({ devCode } = await sendPasswordResetEmail(result.user.email, result.code, request.log));
    }
    // Always the same response so the endpoint can't be used to probe which emails exist.
    return { message: "If an account exists for that email, a reset code has been sent.", demoResetCode: devCode };
  });

  app.post("/auth/reset-password", authRateLimit, async (request) => {
    const input = parseBody(passwordResetSchema, request.body);
    return repository.resetPassword(input.email, input.code, input.newPassword);
  });

  app.post("/auth/logout", async (request) => {
    return repository.logout(authTokenFromRequest(request));
  });

  app.get("/me", async (request) => {
    return requireUser(request, repository);
  });
}

import { z } from "zod";
import { UserSchema } from "./user.js";

const PasswordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(200);

export const RegisterRequestSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().toLowerCase(),
  password: PasswordSchema,
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: PasswordSchema,
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthTokensSchema = z.object({
  access_token: z.string().min(1),
  access_expires_in: z.number().int().positive(),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const AuthResponseSchema = z.object({
  user: UserSchema,
  tokens: AuthTokensSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

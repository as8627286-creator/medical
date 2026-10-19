/**
 * Login form state.
 *
 * Kept out of the `"use server"` module because a "use server" file may only
 * export async functions.
 */

export interface LoginState {
  errors: Record<string, string>;
  message?: string;
  values?: { email?: string };
}

export const initialLoginState: LoginState = { errors: {} };

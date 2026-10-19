"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import {
  addToCart,
  removeCartItem,
  setCartItemQuantity,
  CartError,
} from "@/lib/cart";
import { quantitySchema } from "@/lib/validation/common";
import { formValue } from "@/lib/validation/form";

export type CartActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
};

/**
 * Adding to the cart requires a signed-in customer: the cart is stored against
 * the user account so that it survives across devices.
 */
export async function addToCartAction(
  _prevState: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/cart")}`);
  }

  const productId = formValue(formData, "productId");
  const parsed = quantitySchema.safeParse(Number(formValue(formData, "quantity")));
  if (!parsed.success) {
    return { error: "Enter a valid quantity." };
  }

  try {
    await addToCart(user.id, productId, parsed.data);
  } catch (error) {
    if (error instanceof CartError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/cart");
  return { ok: true, message: "Added to your cart." };
}

export async function setCartItemQuantityAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const itemId = formValue(formData, "itemId");
  const quantity = Number(formValue(formData, "quantity"));

  try {
    await setCartItemQuantity(user.id, itemId, Number.isFinite(quantity) ? quantity : 1);
  } catch (error) {
    if (error instanceof CartError) {
      // Nothing to do: the cart page re-renders the current state.
    }
  }

  revalidatePath("/cart");
}

export async function removeCartItemAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  await removeCartItem(user.id, formValue(formData, "itemId"));
  revalidatePath("/cart");
}

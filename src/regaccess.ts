import type { RegisterAccess, SH4State } from "@/types.ts";
import { registerRange, registerRegex, resolveDoubleReg } from "@/helpers.ts";

export function emptyRegisterAccess(): RegisterAccess {
  return {
    frRead: [],
    frWrite: [],
    xfRead: [],
    xfWrite: [],
    fpulWrite: false,
    fpulRead: false
  };
}

function pushUniqueAccess(target: number[], values: number[]) {
  for (const value of values) {
    if (!target.includes(value)) {
      target.push(value);
    }
  }
}

export function trackRegisterAccess(
  state: SH4State,
  data: string,
  access?: RegisterAccess,
  type?: "read" | "write",
) {
  if (!access) {
    return;
  }

  if (!type) {
    type = "read";
  }

  const frAccess = type === "read" ? access.frRead : access.frWrite;
  const xfAccess = type === "read" ? access.xfRead : access.xfWrite;

  const trimmedData = data.trim();

  const dbl = resolveDoubleReg(state, trimmedData);
  if (dbl) {
    const target = trimmedData.toUpperCase().startsWith("XD")
      ? xfAccess
      : frAccess;
    pushUniqueAccess(target, registerRange(dbl.i, 2));
    return;
  }

  const reg = registerRegex.exec(trimmedData);
  if (!reg) {
    return;
  }

  const regType = reg[1]!.toUpperCase();
  const idx = parseInt(reg[2]!);
  const target = regType === "XF" ? xfAccess : frAccess;
  pushUniqueAccess(target, [idx]);
}

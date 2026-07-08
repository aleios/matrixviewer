// -- Register regex --
import type {
  InstructionResult,
  OperandOptions,
  RegisterAccess,
  SH4State,
} from "@/types.ts";
import { emptyRegisterAccess } from "@/regaccess.ts";

export const registerRegex = /^(FR|XF)(\d+)$/i;
export const fvRegex = /^FV(\d+)$/i;
export const drRegex = /^DR(\d+)$/i;
export const xdRegex = /^XD(\d+)$/i;
export const immRegex = /^#(-?\d+(\.\d+)?)$/;

export function getBanksForState(state: SH4State) {
  return state.frontBank0
    ? { frontBank: state.bank0, backBank: state.bank1 }
    : {
        frontBank: state.bank1,
        backBank: state.bank0,
      };
}

export function pairToDouble(hi: number, lo: number) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);

  view.setFloat32(0, hi, false);
  const hiBits = view.getUint32(0, false);

  view.setFloat32(0, lo, false);
  const loBits = view.getUint32(0, false);

  view.setUint32(0, hiBits, false);
  view.setUint32(4, loBits, false);

  return view.getFloat64(0, false);
}

export function doubleToPair(value: number) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);

  view.setFloat64(0, value, false);
  const hiBits = view.getUint32(0, false);
  const loBits = view.getUint32(4, false);

  view.setUint32(0, hiBits, false);
  const hi = view.getFloat32(0, false);

  view.setUint32(0, loBits, false);
  const lo = view.getFloat32(0, false);

  return [hi, lo];
}

export function isSingleReg(reg: string) {
  return registerRegex.test(reg);
}

export function isDoubleReg(reg: string) {
  return resolveDoubleRegName(reg) !== undefined;
}

export function assertFrontBank(data: string, options: OperandOptions = {}) {
  if (options.allowBackBank) {
    return;
  }

  const operand = data.trim().toUpperCase();

  if (operand.startsWith("XF") || operand.startsWith("XD")) {
    throw new Error(`XMTRX operand ${data} is only valid for supported FMOV`);
  }
}

export function resolveDoubleReg(state: SH4State, reg: string) {
  reg = reg.trim();
  let m = drRegex.exec(reg);

  let idx;
  let bank;
  let name;
  if (m) {
    idx = parseInt(m[1]!);
    bank = getBanksForState(state).frontBank;
    name = "DR";
  } else {
    m = xdRegex.exec(reg);
    if (!m) {
      return undefined;
    }
    idx = parseInt(m[1]!);
    bank = getBanksForState(state).backBank;
    name = "XD";
  }

  if (idx === undefined || idx % 2 != 0 || idx < 0 || idx > 15) {
    throw new Error(
      `Invalid ${name} register: ${reg} (must be even and in range 0-15, got ${idx})`,
    );
  }

  return { bank: bank, i: idx };
}

export function resolveDoubleRegName(reg: string) {
  let m = drRegex.exec(reg);
  if (m) {
    const n = parseInt(m[1]!);
    if (n % 2 != 0 || n < 0 || n > 15)
      throw new Error(
        `Invalid DR register: ${reg} (must be even and in range 0-15, got ${n})`,
      );
    return ["DR", n];
  }
  m = xdRegex.exec(reg);
  if (m) {
    const n = parseInt(m[1]!);
    if (n % 2 != 0 || n < 0 || n > 15)
      throw new Error(
        `Invalid XD register: ${reg} (must be even and in range 0-15, got ${n})`,
      );
    return ["XD", n];
  }
  return undefined;
}

export function registerRange(base: number, count: number): number[] {
  return Array.from({ length: count }, (_, offset) => base + offset);
}

export function instructionResult(
  log: string,
  access: Partial<RegisterAccess> = {},
): InstructionResult {
  return {
    log,
    access: {
      ...emptyRegisterAccess(),
      ...access,
    },
  };
}

export function formatCell(value: number) {
  if (value === 0) {
    return "0.0000";
  }
  const abs = Math.abs(value);
  return abs >= 1e6 || abs < 1e-4 ? value.toExponential(4) : value.toFixed(4);
}

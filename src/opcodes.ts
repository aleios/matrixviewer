import type {OperandOptions, RegisterAccess, SH4State} from "@/types.ts";
import {
    assertFrontBank, doubleToPair,
    drRegex,
    fvRegex,
    getBanksForState, immRegex,
    instructionResult,
    isDoubleReg, pairToDouble,
    registerRange,
    registerRegex, resolveDoubleReg
} from "@/helpers.ts";
import {emptyRegisterAccess, trackRegisterAccess} from "@/regaccess.ts";

function resolveRegister(state: SH4State, data: string, options: OperandOptions = {}) {

    data = data.trim()
    assertFrontBank(data, options)

    const m = data.match(registerRegex)
    if (!m) {
        throw new Error(`Invalid register: ${data}`)
    }

    const kind = m[1]!.toUpperCase()
    const i = parseInt(m[2] || '')

    if(i < 0 || i > 15) {
        throw new Error(`Invalid register index: ${i}`)
    }

    const { frontBank, backBank } = getBanksForState(state)
    const bank = kind === 'FR' ? frontBank : backBank

    return { bank, i }
}

function readOperand(state: SH4State, data: string, access?: RegisterAccess, options?: OperandOptions) {
    const imm = immRegex.exec(data)

    if(imm) {
        return parseFloat(imm[1]!)
    }

    assertFrontBank(data, options)
    trackRegisterAccess(state, data, access, "read")

    // TODO: Pairwise double
    const dbl = resolveDoubleReg(state, data)
    if (dbl) {
        const { bank, i } = dbl
        return pairToDouble(bank[i]!, bank[i + 1]!)
    }

    const { bank, i } = resolveRegister(state, data)
    return bank[i]!
}

function writeOperand(state: SH4State, data: string, value: number, access?: RegisterAccess, options?: OperandOptions) {

    assertFrontBank(data, options)
    trackRegisterAccess(state, data, access, "write")

    const dbl = resolveDoubleReg(state, data)
    if (dbl) {
        const { bank, i } = dbl
        const pair = doubleToPair(value)
        bank[i] = pair[0]!
        bank[i + 1] = pair[1]!
        return
    }

    const { bank, i } = resolveRegister(state, data)
    bank[i] = value
}

function splitOperands(data: string) {
    return data.split(",").map(s => s.trim()).filter(s => s.length > 0)
}

//
// -- Opcodes --
//

function fschg(state: SH4State, data: string) {
    state.pairMode = !state.pairMode
    return instructionResult(`FSCHG -> pairMode=${state.pairMode}`)
}

function frchg(state: SH4State, data: string) {
    state.frontBank0 = !state.frontBank0
    return instructionResult(`FRCHG -> Swapped front bank? ${state.frontBank0}`)
}

function fldi0(state: SH4State, data: string) {
    const { bank, i } = resolveRegister(state, data)
    // TODO: Check for correct register type
    bank[i] = 0.0
    return instructionResult(`${data} = 0.0`, {
        frWrite: [i]
    })
}

function fldi1(state: SH4State, data: string) {
    const { bank, i } = resolveRegister(state, data)
    bank[i] = 1.0
    return instructionResult(`${data} = 1.0`, {
        frWrite: [i]
    })
}

function fmov(state: SH4State, data: string) {
    const operands = splitOperands(data)
    if (operands.length !== 2) {
        throw new Error(`Invalid FMOV operands: ${data}`)
    }

    const src = operands[0] || ''
    const dest = operands[1] || ''
    const access = emptyRegisterAccess()

    const options: OperandOptions = {
        allowBackBank: true,
        pairwiseSingle: state.pairMode && !isDoubleReg(src) && !isDoubleReg(dest),
    }

    const val = readOperand(state, src, access, options)
    writeOperand(state, dest, val, access, options)

    if (options.pairwiseSingle) {
        return instructionResult(`${dest} = ${src} pairwise copy in SZ=1 mode`, access)
    }

    return instructionResult(`${dest} = ${src} (${val})`, access)
}

function setupArithmatic(state: SH4State, data: string, access?: RegisterAccess) {
    const operands = splitOperands(data)
    if (operands.length !== 2) {
        throw new Error(`Invalid operands: ${data}`)
    }
    const src = operands[0] || ''
    const dest = operands[1] || ''

    const srcIsDouble = isDoubleReg(src)
    const destIsDouble = isDoubleReg(dest)

    if (srcIsDouble != destIsDouble) {
        throw new Error(`FMOV cannot mix single and double registers (got ${src}, ${dest})`)
    }

    const a = readOperand(state, src, access)
    const b = readOperand(state, dest, access)

    return { dest, a, b }
}

function fadd(state: SH4State, data: string) {

    const access = emptyRegisterAccess()

    const { dest, a, b } = setupArithmatic(state, data, access)

    const res = b + a

    writeOperand(state, dest, res, access)
    return instructionResult(`${dest} = ${b} + ${a} -> ${res}`, access)
}

function fsub(state: SH4State, data: string) {
    const access = emptyRegisterAccess()
    const { dest, a, b } = setupArithmatic(state, data, access)

    const res = b - a

    writeOperand(state, dest, res, access)
    return instructionResult(`${dest} = ${b} - ${a} -> ${res}`, access)
}

function fmul(state: SH4State, data: string) {
    const access = emptyRegisterAccess()
    const { dest, a, b } = setupArithmatic(state, data, access)

    const res = b * a;
    writeOperand(state, dest, res, access)
    return instructionResult(`${dest} = ${b} * ${a} -> ${res}`, access)
}

function fdiv(state: SH4State, data: string) {
    const access = emptyRegisterAccess()
    const { dest, a, b } = setupArithmatic(state, data, access)
    const res = b / a;
    writeOperand(state, dest, res, access)
    return instructionResult(`${dest} = ${b} / ${a} -> ${res}`, access)
}

function fneg(state: SH4State, data: string) {
    const { bank, i } = resolveRegister(state, data)
    bank[i] = -bank[i]!
    return instructionResult(`${data} = ${bank[i]}`, {
        frWrite: [i],
        frRead: [i]
    });
}

function fsrra(state: SH4State, data: string) {
    const { bank, i } = resolveRegister(state, data)
    bank[i] = Math.fround(1.0 / Math.sqrt(bank[i]!))
    return instructionResult(`${data} = ${bank[i]}`, {
        frWrite: [i],
        frRead: [i]
    });
}

function ftrc(state: SH4State, data: string) {
    const operands = splitOperands(data)
    if (operands.length !== 2 || operands[1]!.trim().toUpperCase() != 'FPUL') {
        throw new Error(`Invalid FTRC operands: ${data}`)
    }

    const { bank, i } = resolveRegister(state, operands[0]!)
    state.fpul = Math.trunc(bank[i]!)
    return instructionResult(`FPUL = trunc(${operands[0]!} -> ${state.fpul})`, {
        frRead: [i]
    });
}

function fsca(state: SH4State, data: string) {
    const operands = splitOperands(data)
    if (operands.length !== 2 || operands[0]!.trim().toUpperCase() != 'FPUL') {
        throw new Error(`Invalid FSCA operands: ${data}`)
    }

    const target = operands[1]!.trim()
    const dm = drRegex.exec(target)
    const fm = registerRegex.exec(target)

    let base
    if (dm) {
        base = parseInt(dm[1]!)
    } else if (fm && fm[1]!.toUpperCase() === 'FR') {
        base = parseInt(fm[2]!)
    } else {
        throw new Error(`FSCA target must be DRn or FRn (got ${target})`)
    }

    if (base % 2 != 0) {
        throw new Error(`FSCA target must be even (got ${base})`)
    }

    const d = ((state.fpul & 0xFFFF) / 65536.0) * 2.0 * Math.PI
    const bank = getBanksForState(state).frontBank
    bank[base] = Math.sin(d)
    bank[base + 1] = Math.cos(d)

    return instructionResult(`FR${base} = sin(2.0*PI*FPUL/65536) -> ${bank[base]}, FR${base + 1} = cos(2.0*PI*FPUL/65536) -> ${bank[base + 1]}`, {
        frWrite: [base, base + 1]
    })
}

function fsqrt(state: SH4State, data: string) {
    const { bank, i } = resolveRegister(state, data)
    bank[i] = Math.sqrt(bank[i]!)
    return instructionResult(`${data} = sqrt(${bank[i]})`, {
        frWrite: [i],
        frRead: [i]
    })
}

function fipr(state: SH4State, data: string) {
    const operands = splitOperands(data)
    if (operands.length !== 2) {
        throw new Error(`Invalid FIPR, requires 2 operands: ${data}`)
    }

    const m1 = fvRegex.exec(operands[0]!)
    const m2 = fvRegex.exec(operands[1]!)

    if (!m1 || !m2) {
        throw new Error(`Invalid FIPR, requires FVm,FVn: ${data}`)
    }

    const base0 = parseInt(m1[1]!)
    const base1 = parseInt(m2[1]!)

    if(base0 % 4 != 0 || base1 % 4 != 0) {
        throw new Error(`FIPR requires FVm and FVn to be multiples of 4 (got ${base0}, ${base1})`)
    }

    if(base0 < 0 || base0 > 15 || base1 < 0 || base1 > 15) {
        throw new Error(`FIPR FV out of range (got ${base0}, ${base1})`)
    }

    const bank = getBanksForState(state).frontBank

    const res = (bank[base0]! * bank[base1]!) + (bank[base0 + 1]! * bank[base1 + 1]!) + (bank[base0 + 2]! * bank[base1 + 2]!) + (bank[base0 + 3]! * bank[base1 + 3]!)
    bank[base1 + 3] = res
    return instructionResult(`${data} = fv${base0} FIPR fv${base1} -> ${res}`, {
        frRead: [
            ...registerRange(base0, 4),
            ...registerRange(base1, 4)
        ],
        frWrite: [base1 + 3]
    })

    // fr7 = fv0 FIPR fv4. (fr0 DOT fr4 + fr1 DOT fr5 + fr2 DOT fr6 + fr3 DOT fr7)
}

function ftrv(state: SH4State, data: string) {

    return instructionResult(`FTRV not implemented`)
}

function fmac(state: SH4State, data: string) {
    // fr0, FRm, FRn
    const operands = splitOperands(data)
    if (operands.length !== 3) {
        throw new Error(`Invalid FMAC, requires 3 operands: ${data}`)
    }

    if (operands[0]!.trim().toUpperCase() != 'FR0') {
        throw new Error(`FMAC requires FR0 as the first operand (got ${operands[0]})`)
    }

    const access = emptyRegisterAccess()

    const f0 = readOperand(state, operands[0]!, access)
    const a = readOperand(state, operands[1]!, access)
    const b = readOperand(state, operands[2]!, access)

    const result = f0 * a + b
    writeOperand(state, operands[2]!, result, access)
    return instructionResult(`${operands[2]!} = ${f0} * ${a} + ${b} -> ${result}`, access)
}

export const opcodes = [
    { name: "FRCHG", func: frchg },
    { name: "FSCHG", func: fschg },
    { name: 'FLDI0', func: fldi0 },
    { name: 'FLDI1', func: fldi1 },
    { name: 'FMOV', func: fmov },
    { name: 'FADD', func: fadd },
    { name: 'FSUB', func: fsub },
    { name: 'FMUL', func: fmul },
    { name: 'FDIV', func: fdiv },
    { name: 'FNEG', func: fneg },
    { name: 'FSRRA', func: fsrra },
    { name: 'FTRC', func: ftrc },
    { name: 'FSCA', func: fsca },
    { name: 'FIPR', func: fipr },
    { name: 'FTRV', func: ftrv },
    { name: 'FMAC', func: fmac },
    { name: 'FSQRT', func: fsqrt }
]
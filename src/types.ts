export type Matrix = [
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
    number, number, number, number
]

export interface SH4State {
    bank0: Matrix,
    bank1: Matrix,
    frontBank0: boolean,
    pairMode: boolean,
    fpul: number
}

export type RegisterAccess = {
    frRead: number[]
    frWrite: number[]
    xfRead: number[]
    xfWrite: number[]
}

export interface SessionData {
    sh4: SH4State
    sh4Initial: SH4State
    logs: string[]
    states: SH4State[]
    instrIndex: InstructionIndex[]
    accesses: RegisterAccess[]
    asm: string
}

export type InstructionIndex = { index: number, line: string }

export type InstructionResult = {
    log: string
    access: RegisterAccess
}

export type OperandOptions = {
    allowBackBank?: boolean,
    pairwiseSingle?: boolean
}
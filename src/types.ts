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

export interface SessionData {
    sh4: SH4State
    sh4Initial: SH4State
    logs: string[]
    states: SH4State[]
    instrIndex: InstructionIndex[]
    asm: string
}

export type InstructionIndex = { index: number, line: string }
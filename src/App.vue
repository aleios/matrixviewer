<template>
  <div class="flex flex-col">
    <div class="p-4 bg-gray-950 select-none">SH4 Matrix Viewer</div>
    <div class="flex gap-6 p-4">
      <div class="w-1/4">
        <p>Assembly</p>
        <textarea v-model="asmData" class="border w-full p-1" rows="10" @change="parseAsm"></textarea>
        <div class="flex gap-2">
          <UIButton @click="clearAll">Clear</UIButton>
          <UIButton @click="importStr">Import</UIButton>
          <UIButton @click="exportStr">Export</UIButton>
        </div>
        <p>Steps</p>
        <StepsContainer :instrIndex="instrIndex" @step-changed="stepChanged" />
      </div>
      <div>
        Matrices
        <Tabs v-model:active="activeTab">
          <TabsHeading>
            <TabsTrigger name="live">Live</TabsTrigger>
            <TabsTrigger name="initial">Initial Values</TabsTrigger>
          </TabsHeading>
          <TabsFrame>
            <TabsContent name="live">
              <div class="flex gap-8">
                <div>
                  <p>Front Bank</p>
                  <MatrixBlock ref="frontBank" v-model:matrix="currentBank0" :front="true" :flip-order="flipCellOrder" />
                </div>
                <div>
                  <p>XMTRX</p>
                  <MatrixBlock ref="xmtrx" v-model:matrix="currentBank1" :flip-order="flipCellOrder" />
                </div>
              </div>
            </TabsContent>
            <TabsContent name="initial">
              <div class="flex gap-8">
                <div>
                  <p>Front Bank</p>
                  <MatrixBlock v-model:matrix="sh4Initial.bank0" :front="true" :editable="true" :flip-order="flipCellOrder" />
                </div>
                <div>
                  <p>XMTRX</p>
                  <MatrixBlock v-model:matrix="sh4Initial.bank1" :editable="true" :flip-order="flipCellOrder" />
                </div>
              </div>
            </TabsContent>
          </TabsFrame>
        </Tabs>
        <div class="flex gap-2">
          <span>Flip cell order?</span><input type="checkbox" v-model="flipCellOrder" />
        </div>
        <div>
          <p>Log</p>
          <textarea class="border w-full p-1" rows="10" readonly>
{{ logs.join("\n") }}
          </textarea>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import StepsContainer from "@/StepsContainer.vue";
import {computed, reactive, ref, watch} from "vue";
import {cloneDeep, flip} from "lodash-es";
import MatrixBlock from "@/MatrixBlock.vue";
import type {Matrix, SH4State, InstructionIndex, SessionData} from "@/types.ts";
import {matEmpty, matIdentity} from "@/matrixops.ts";
import { Tabs, TabsHeading, TabsContent, TabsTrigger, TabsFrame } from "@/tabs";
import { useStorage } from '@vueuse/core'
import {
  doubleToPair, drRegex,
  getBanksForState,
  immRegex,
  isDoubleReg, pairToDouble,
  registerRegex,
  resolveDoubleReg
} from "@/helpers.ts";
import UIButton from "@/UIButton.vue";

const sh4DefaultValues: SH4State = {
  bank0: matEmpty(),
  bank1: matEmpty(),
  frontBank0: true,
  pairMode: false,
  fpul: 0
}

const sessionData = useStorage<SessionData>('sh4-state', {
  sh4: cloneDeep(sh4DefaultValues),
  sh4Initial: cloneDeep(sh4DefaultValues),
  logs: [] as string[],
  states: [] as SH4State[],
  instrIndex: [] as InstructionIndex[],
  asm: ""
})

const sh4 = computed({
  get: () => sessionData.value.sh4,
  set: (state: SH4State) => sessionData.value.sh4 = state
})

const sh4Initial = computed({
  get: () => sessionData.value.sh4Initial,
  set: (state: SH4State) => sessionData.value.sh4Initial = state
})

const logs = computed({
  get: () => sessionData.value.logs,
  set: (logs: string[]) => sessionData.value.logs = logs
})

const states = computed({
  get: () => sessionData.value.states,
  set: (states: SH4State[]) => sessionData.value.states = states
})

const instrIndex = computed({
  get: () => sessionData.value.instrIndex,
  set: (instrIndex: InstructionIndex[]) => sessionData.value.instrIndex = instrIndex
})

const asmData = computed({
  get: () => sessionData.value.asm,
  set: (asm: string) => sessionData.value.asm = asm
})

const activeTab = ref("live")
const flipCellOrder = ref(false)

const frontBank = ref<InstanceType<typeof MatrixBlock>>()
const xmtrx = ref<InstanceType<typeof MatrixBlock>>()

const currentBank0 = computed(() => sh4.value.frontBank0 ? sh4.value.bank0 : sh4.value.bank1)
const currentBank1 = computed(() => sh4.value.frontBank0 ? sh4.value.bank1 : sh4.value.bank0)

function resolveRegister(state: SH4State, data: string) {

  data = data.trim()

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

function fschg(state: SH4State, data: string) {
  state.pairMode = !state.pairMode
  return `FSCHG -> pairMode=${state.pairMode}`
}

function frchg(state: SH4State, data: string) {
  state.frontBank0 = !state.frontBank0
  return `FRCHG -> Swapped front bank? ${state.frontBank0}`
}

function fldi0(state: SH4State, data: string) {
  const { bank, i } = resolveRegister(state, data)
  bank[i] = 0.0
  return `${data} = 0.0`;
}

function fldi1(state: SH4State, data: string) {
  const { bank, i } = resolveRegister(state, data)
  bank[i] = 1.0
  return `${data} = 1.0`;
}

function regToReg(state: SH4State, src: string, dest: string) {

  const sm = registerRegex.exec(src)
  const dm = registerRegex.exec(dest)

  if (!sm || !dm) {
    return false
  }

  const { bank: srcBank, i: srcI } = resolveRegister(state, sm[0]!)
  const { bank: destBank, i: destI } = resolveRegister(state, dm[0]!)

  if (!state.pairMode) {
    destBank[destI] = srcBank[srcI]!
    return true
  }

  if (srcI % 2 != 0 || destI % 2 != 0) {
    throw new Error(`FMOV in pair mode requires even registers (got ${src}, ${dest})`)
  }

  const srcPair = [ srcBank[srcI]!, srcBank[srcI + 1]! ]
  destBank[destI] = srcPair[0]!
  destBank[destI + 1] = srcPair[1]!

  return true
}

function readOperand(state: SH4State, data: string) {
  const imm = immRegex.exec(data)

  if(imm) {
    return parseFloat(imm[1]!)
  }
  // TODO: Pairwise double
  const dbl = resolveDoubleReg(state, data)
  if (dbl) {
    const { bank, i } = dbl
    return pairToDouble(bank[i]!, bank[i + 1]!)
  }

  const { bank, i } = resolveRegister(state, data)
  return bank[i]!
}

function writeOperand(state: SH4State, data: string, value: number) {

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

function fmov(state: SH4State, data: string) {
  const operands = splitOperands(data)
  if (operands.length !== 2) {
    throw new Error(`Invalid FMOV operands: ${data}`)
  }
  const src = operands[0] || ''
  const dest = operands[1] || ''

  if (regToReg(state, src, dest)) {
    if(state.pairMode) {
      return `${dest} = ${src} pairwise copy in SZ=1 mode`
    }
    return `${dest} = ${src} (${readOperand(state, dest)})`
  }

  const val = readOperand(state, src)
  writeOperand(state, dest, val)
  return `${dest} = ${src} (${val})`
}

function setupArithmatic(state: SH4State, data: string) {
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

  const a = readOperand(state, src)
  const b = readOperand(state, dest)

  return { dest, a, b }
}

function fadd(state: SH4State, data: string) {

  const { dest, a, b } = setupArithmatic(state, data)

  const res = b + a

  writeOperand(state, dest, res)
  return `${dest} = ${b} + ${a} -> ${res}`
}

function fsub(state: SH4State, data: string) {
  const { dest, a, b } = setupArithmatic(state, data)

  const res = b - a

  writeOperand(state, dest, res)
  return `${dest} = ${b} - ${a} -> ${res}`
}

function fmul(state: SH4State, data: string) {
  const { dest, a, b } = setupArithmatic(state, data)

  const res = b * a;
  writeOperand(state, dest, res)
  return `${dest} = ${b} * ${a} -> ${res}`
}

function fdiv(state: SH4State, data: string) {
  const { dest, a, b } = setupArithmatic(state, data)
  const res = b / a;
  writeOperand(state, dest, res)
  return `${dest} = ${b} / ${a} -> ${res}`
}

function fneg(state: SH4State, data: string) {
  const { bank, i } = resolveRegister(state, data)
  bank[i] = -bank[i]!
  return `${data} = ${bank[i]}`;
}

function fsrra(state: SH4State, data: string) {
  const { bank, i } = resolveRegister(state, data)
  bank[i] = Math.fround(1.0 / Math.sqrt(bank[i]!))
  return `${data} = ${bank[i]}`;
}

function ftrc(state: SH4State, data: string) {
  const operands = splitOperands(data)
  if (operands.length !== 2 || operands[1]!.trim().toUpperCase() != 'FPUL') {
    throw new Error(`Invalid FTRC operands: ${data}`)
  }

  const { bank, i } = resolveRegister(state, operands[0]!)
  state.fpul = Math.trunc(bank[i]!)
  return `FPUL = trunc(${operands[0]!} -> ${state.fpul})`
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

  return `FR${base} = sin(2.0*PI*FPUL/65536) -> ${bank[base]}, FR${base + 1} = cos(2.0*PI*FPUL/65536) -> ${bank[base + 1]}`
}

const opcodes = [
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
  { name: 'FSCA', func: fsca }
]

function executeLine(state: SH4State, line: string): string {
  let parts = line.split(" ");
  parts = [
    ...parts.slice(0, 2 - 1),
    parts.slice(2 - 1).join(" ")
  ];
  if(parts.length < 1) {
    throw new Error("Line invalid")
  }

  const op = parts[0]!.toUpperCase()
  const args = parts[1] || ""

  const resolvedOpcode = opcodes.find(o => o.name === op)
  let res: string = ""
  if(resolvedOpcode) {
    res = resolvedOpcode.func(state, args)
  } else {
    throw new Error(`Unknown opcode: ${op}`)
  }
  return res
}

function clearState() {
  frontBank.value?.clearHighlightedCells()
  xmtrx.value?.clearHighlightedCells()

  sh4.value = cloneDeep(sh4Initial.value)
}

function clearAll() {
  clearState()
  logs.value = []
  states.value = []
  instrIndex.value = []
  asmData.value = ""
  sh4.value = cloneDeep(sh4DefaultValues)
  sh4Initial.value = cloneDeep(sh4DefaultValues)
}

function importStr() {
  const input = prompt("Enter string to import")
  if(input) {
    try {
      sessionData.value = JSON.parse(input)
    } catch (e) {
      alert("Invalid Data")
      return
    }
  }
}

function exportStr() {
  navigator.clipboard.writeText(JSON.stringify(sessionData.value))
  alert("Exported to clipboard")
}

function parseAsm() {
  clearState()
  logs.value = []
  states.value = []
  instrIndex.value = []

  const lines = asmData.value.split("\n").map(line => line.trim()).filter(line => line.length > 0)
  const state = cloneDeep(sh4Initial.value)

  // Add initial state to stack
  instrIndex.value.push({ index: -1, line: "Initial State" })
  states.value.push(cloneDeep(state))
  logs.value.push("-- Starting state --")

  for(const [i, line] of lines.entries()) {
    // Skip comments
    if (line.startsWith('!') || line.startsWith(';') || line.startsWith('#')) {
      continue;
    }

    let desc = ""
    try {
      desc = executeLine(state, line)
    } catch (e) {
      logs.value.push(`Line ${i+1}: ${e}`)
      continue;
    }
    logs.value.push(`Line ${i+1}: ${desc}`)
    instrIndex.value.push({ index: i, line })
    states.value.push(cloneDeep(state))
  }

}

function showState(index: number) {
  const state = states.value[index]
  if (!state) {
    clearState()
    return
  }
  const instrText = instrIndex.value[index]?.line.toUpperCase()
  if (!instrText) {
    clearState()
    return
  }
  const frHighlight = new Set<number>();
  const drHighlight = new Set<number>();
  const xdHighlight = new Set<number>();
  const xfHighlight = new Set<number>();

  const fvMatch = instrText.match(/\bFV(\d+)\b/);
  if (fvMatch) {
    const base = Number.parseInt(fvMatch[1] || '', 10);
    frHighlight.add(base);
    frHighlight.add(base + 1);
    frHighlight.add(base + 2);
    frHighlight.add(base + 3);
  }

  for (const match of instrText.matchAll(/\bDR(\d+)\b/g)) {
    const base = Number.parseInt(match[1] || '', 10);
    drHighlight.add(base);
    frHighlight.add(base);
    frHighlight.add(base + 1);
  }

  for (const match of instrText.matchAll(/\bXD(\d+)\b/g)) {
    const base = Number.parseInt(match[1] || '', 10);
    xdHighlight.add(base);
    xfHighlight.add(base);
    xfHighlight.add(base + 1);
  }

  for (const match of instrText.matchAll(/\bFR(\d+)\b/g)) {
    frHighlight.add(Number.parseInt(match[1] || '', 10));
  }

  for (const match of instrText.matchAll(/\bXF(\d+)\b/g)) {
    xfHighlight.add(Number.parseInt(match[1] || '', 10));
  }

  if(frontBank.value) {
    frontBank.value?.highlightCells(Array.from(frHighlight));
    sh4.value.bank0 = cloneDeep(state.bank0) || matEmpty()
  }

  if(xmtrx.value) {
    xmtrx.value.highlightCells(Array.from(xfHighlight));
    sh4.value.bank1 = cloneDeep(state.bank1) || matEmpty()
  }


  sh4.value.frontBank0 = state.frontBank0
}

function stepChanged(index: number) {
  showState(index)
}

watch(sh4Initial, () => {
  parseAsm()
}, {
  deep: true
})

// Initial parse
parseAsm()

</script>

<template>
  <div class="flex flex-col">
    <div class="p-4 bg-gray-950 select-none">
      SH4 Matrix Viewer
    </div>
    <div class="flex gap-6 p-4">
      <div class="w-1/4">
        <p>Assembly</p>
        <textarea
          v-model="asmData"
          class="border w-full p-1"
          rows="10"
          @change="parseAsm"
        />
        <div class="flex gap-2">
          <UIButton @click="clearAll">
            Clear
          </UIButton>
          <UIButton @click="importStr">
            Import
          </UIButton>
          <UIButton @click="exportStr">
            Export
          </UIButton>
        </div>
        <p>Steps</p>
        <StepsContainer
          :instr-index="instrIndex"
          @step-changed="stepChanged"
        />
        <div class="bg-gray-950 p-1">
          <p>Help</p>
          <p>Clicking a step shows what happened to a register during that operation</p>
          <ul>
            <li><span class="bg-green-900/70">Green</span> = Write</li>
            <li><span class="bg-sky-900/70">Blue</span> = Read</li>
            <li><span class="bg-purple-900/80">Purple</span> = Read/Write</li>
          </ul>
        </div>
      </div>
      <div>
        Matrices
        <Tabs v-model:active="activeTab">
          <TabsHeading>
            <TabsTrigger name="live">
              Live
            </TabsTrigger>
            <TabsTrigger name="initial">
              Initial Values
            </TabsTrigger>
          </TabsHeading>
          <TabsFrame>
            <TabsContent name="live">
              <div class="flex gap-8">
                <div>
                  <p>Front Bank</p>
                  <MatrixBlock
                    ref="frontBank"
                    v-model:matrix="currentBank0"
                    :front="true"
                    :flip-order="flipCellOrder"
                  />
                </div>
                <div>
                  <p>XMTRX</p>
                  <MatrixBlock
                    ref="xmtrx"
                    v-model:matrix="currentBank1"
                    :flip-order="flipCellOrder"
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent name="initial">
              <div class="flex gap-8">
                <div>
                  <p>Front Bank</p>
                  <MatrixBlock
                    v-model:matrix="sh4Initial.bank0"
                    :front="true"
                    :editable="true"
                    :flip-order="flipCellOrder"
                  />
                </div>
                <div>
                  <p>XMTRX</p>
                  <MatrixBlock
                    v-model:matrix="sh4Initial.bank1"
                    :editable="true"
                    :flip-order="flipCellOrder"
                  />
                </div>
              </div>
            </TabsContent>
          </TabsFrame>
        </Tabs>
        <div class="flex flex-col gap-2 p-2 bg-gray-900">
          <RegisterCell
            v-model:data="sh4.fpul"
            label="FPUL"
            :access-type="fpulHighlight"
          />
          <span>Register Pairs</span>
          <PairsGrid
            ref="frontBankPairs"
            :bank="currentBank0"
          />
          <PairsGrid
            ref="xmtrxPairs"
            :bank="currentBank1"
            back-bank
          />
        </div>
        <div class="flex gap-2">
          <span>Flip cell order?</span><input
            v-model="flipCellOrder"
            type="checkbox"
          >
        </div>
        <div>
          <p>Log</p>
          <textarea
            v-model="formattedLogs"
            class="border w-full p-1"
            rows="10"
            readonly
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import StepsContainer from "@/StepsContainer.vue";
import {computed, ref, watch} from "vue";
import {cloneDeep} from "lodash-es";
import MatrixBlock from "@/MatrixBlock.vue";
import type {
  InstructionIndex,
  InstructionResult,
  RegisterAccess,
  RegisterAccessType,
  SessionData,
  SH4State
} from "@/types.ts";
import {matEmpty} from "@/matrixops.ts";
import {Tabs, TabsContent, TabsFrame, TabsHeading, TabsTrigger} from "@/tabs";
import {useStorage} from '@vueuse/core'
import UIButton from "@/UIButton.vue";
import {emptyRegisterAccess} from "@/regaccess.js";
import {opcodes} from "@/opcodes.ts";
import PairsGrid from "@/PairsGrid.vue";
import RegisterCell from "@/RegisterCell.vue";

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
  accesses: [] as RegisterAccess[],
  asm: ""
}, localStorage, {
  mergeDefaults: true
})

function useSessionField<K extends keyof SessionData>(key: K) {
  return computed({
    get: () => sessionData.value[key],
    set: (value: SessionData[K]) => {
      sessionData.value[key] = value
    }
  })
}

const sh4 = useSessionField('sh4')
const sh4Initial = useSessionField('sh4Initial')
const logs = useSessionField('logs')
const states = useSessionField('states')
const instrIndex = useSessionField('instrIndex')
const asmData = useSessionField('asm')
const accesses = useSessionField('accesses')

const activeTab = ref("live")
const flipCellOrder = ref(false)

const frontBank = ref<InstanceType<typeof MatrixBlock>>()
const xmtrx = ref<InstanceType<typeof MatrixBlock>>()
const frontBankPairs = ref<InstanceType<typeof PairsGrid>>()
const xmtrxPairs = ref<InstanceType<typeof PairsGrid>>()

const currentBank0 = computed(() => sh4.value.frontBank0 ? sh4.value.bank0 : sh4.value.bank1)
const currentBank1 = computed(() => sh4.value.frontBank0 ? sh4.value.bank1 : sh4.value.bank0)

const formattedLogs = computed(() => logs.value.join("\n"))

const fpulHighlight = ref<RegisterAccessType>('none')

function executeLine(state: SH4State, line: string): InstructionResult {
  let parts = line.split(" ");
  parts = [
    ...parts.slice(0, 1),
    parts.slice(1).join(" ")
  ];
  if (parts.length < 1) {
    throw new Error("Line invalid")
  }

  const op = parts[0]!.toUpperCase()
  const args = parts[1] || ""

  const resolvedOpcode = opcodes.find(o => o.name === op)
  let res: InstructionResult
  if (resolvedOpcode) {
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
  accesses.value = []
  asmData.value = ""
  sh4.value = cloneDeep(sh4DefaultValues)
  sh4Initial.value = cloneDeep(sh4DefaultValues)
}

function importStr() {
  const input = prompt("Enter string to import")
  if (input) {
    try {
      sessionData.value = JSON.parse(input)
    } catch {
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
  accesses.value = []

  const lines = asmData.value.split("\n").map(line => line.trim()).filter(line => line.length > 0)
  const state = cloneDeep(sh4Initial.value)

  // Add initial state to stack
  instrIndex.value.push({index: -1, line: "Initial State"})
  states.value.push(cloneDeep(state))
  logs.value.push("-- Starting state --")
  accesses.value.push(emptyRegisterAccess())

  for (const [i, line] of lines.entries()) {
    // Skip comments
    if (line.startsWith('!') || line.startsWith(';') || line.startsWith('#')) {
      continue;
    }

    let res: InstructionResult
    try {
      res = executeLine(state, line)
    } catch (e) {
      logs.value.push(`Line ${i + 1}: ${e}`)
      continue;
    }
    logs.value.push(`Line ${i + 1}: ${res.log}`)
    instrIndex.value.push({index: i, line})
    states.value.push(cloneDeep(state))
    accesses.value.push(res.access)
  }

}

function showState(index: number) {
  const state = states.value[index]
  if (!state) {
    clearState()
    return
  }

  const access = accesses.value[index] || emptyRegisterAccess()

  if (frontBank.value) {
    frontBank.value?.highlightCells({
      read: access.frRead,
      write: access.frWrite
    })
    sh4.value.bank0 = cloneDeep(state.bank0) || matEmpty()
  }

  if (xmtrx.value) {
    xmtrx.value.highlightCells({
      read: access.xfRead,
      write: access.xfWrite
    });
    sh4.value.bank1 = cloneDeep(state.bank1) || matEmpty()
  }

  // Pairs
  if (frontBankPairs.value) {
    frontBankPairs.value?.highlightCells({
      read: access.frRead,
      write: access.frWrite
    })
  }
  if (xmtrxPairs.value) {
    xmtrxPairs.value?.highlightCells({
      read: access.xfRead,
      write: access.xfWrite
    })
  }

  // TODO: generalize this
  if (access.fpulWrite && access.fpulRead) {
    fpulHighlight.value = 'read-write'
  } else if (access.fpulWrite) {
    fpulHighlight.value = 'write'
  } else if (access.fpulRead) {
    fpulHighlight.value = 'read'
  } else {
    fpulHighlight.value = 'none'
  }

  sh4.value.frontBank0 = state.frontBank0
  sh4.value.fpul = state.fpul
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

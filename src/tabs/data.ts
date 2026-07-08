import type { InjectionKey, Ref } from "vue";

export interface TabsContext {
  activeName: Ref<string>;
  setActiveName: (name: string) => void;
}

export const TabsContextKey = Symbol() as InjectionKey<TabsContext>;

import { create } from "zustand";
import { TERMS_VERSION, termsItems } from "../data/termsData";

const STORAGE_KEY = "mpe_terms_accepted_version";

interface TermsStore {
  modalOpen: boolean;
  accepted: boolean;
  checkedItems: Set<string>;
  openModal: () => void;
  closeModal: () => void;
  toggleItem: (id: string) => void;
  acceptTerms: () => void;
}

export const useTermsStore = create<TermsStore>((set) => ({
  modalOpen: false,
  accepted: localStorage.getItem(STORAGE_KEY) === TERMS_VERSION,
  checkedItems: new Set<string>(),

  openModal: () => set({ modalOpen: true, checkedItems: new Set() }),
  closeModal: () => set({ modalOpen: false }),

  toggleItem: (id) =>
    set((state) => {
      const next = new Set(state.checkedItems);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { checkedItems: next };
    }),

  acceptTerms: () => {
    localStorage.setItem(STORAGE_KEY, TERMS_VERSION);
    set({ accepted: true, modalOpen: false });
    window.dispatchEvent(new CustomEvent("mpe:terms-accepted"));
  },
}));

/** 检查当前协议版本是否已被接受 */
export function isTermsAccepted(): boolean {
  return localStorage.getItem(STORAGE_KEY) === TERMS_VERSION;
}

/** 获取所有条款是否全部勾选 */
export function isAllChecked(checkedItems: Set<string>): boolean {
  return termsItems.every((item) => checkedItems.has(item.id));
}

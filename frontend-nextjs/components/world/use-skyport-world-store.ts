"use client";

import { create } from "zustand";

interface SkyportWorldState {
  playerPosition: [number, number, number];
  playerMotion: "idle" | "walk" | "run";
  nearDistrictId: string | null;
  selectedActionIndex: number;
  selectedActionSource: "eye" | "keyboard" | "default";
  introReady: boolean;
  setPlayerPosition: (position: [number, number, number]) => void;
  setPlayerMotion: (motion: "idle" | "walk" | "run") => void;
  setNearDistrictId: (districtId: string | null) => void;
  setSelectedActionIndex: (index: number, source: "eye" | "keyboard" | "default") => void;
  setIntroReady: (value: boolean) => void;
}

export const useSkyportWorldStore = create<SkyportWorldState>((set) => ({
  playerPosition: [0, 0, 18],
  playerMotion: "idle",
  nearDistrictId: null,
  selectedActionIndex: 1,
  selectedActionSource: "default",
  introReady: false,
  setPlayerPosition: (position) => set(() => ({ playerPosition: position })),
  setPlayerMotion: (motion) => set(() => ({ playerMotion: motion })),
  setNearDistrictId: (districtId) =>
    set((state) => ({
      nearDistrictId: districtId,
      selectedActionIndex: districtId === state.nearDistrictId ? state.selectedActionIndex : 1,
      selectedActionSource: districtId === state.nearDistrictId ? state.selectedActionSource : "default",
    })),
  setSelectedActionIndex: (index, source) =>
    set(() => ({
      selectedActionIndex: index,
      selectedActionSource: source,
    })),
  setIntroReady: (value) => set(() => ({ introReady: value })),
}));

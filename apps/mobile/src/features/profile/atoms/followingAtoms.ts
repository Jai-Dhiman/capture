import { atom } from "jotai";

export const followingMapAtom = atom<Record<string, boolean | null>>({});

export const isFollowingAtom = (userId: string) =>
  atom(
    (get) => get(followingMapAtom)[userId] ?? null,
    (get, set, newValue: boolean | null) => {
      const map = get(followingMapAtom);
      set(followingMapAtom, {
        ...map,
        [userId]: newValue,
      });
    }
  );

import { createContext, type Dispatch, type SetStateAction } from "react";
import type { Card } from "./protocol";

//lets any card on screen ask for the large readable copy shown while it is hovered,
//or for the window-sized view its zoom button opens
export type CardViews = {
  setPreview: Dispatch<SetStateAction<Card | null>>;
  zoom: (card: Card) => void;
};

export const CardPreviewContext = createContext<CardViews | null>(null);

import { createContext, type Dispatch, type SetStateAction } from "react";
import type { Card } from "./protocol";

//lets any card on screen ask for the large readable copy shown while it is hovered
export const CardPreviewContext = createContext<Dispatch<SetStateAction<Card | null>> | null>(null);

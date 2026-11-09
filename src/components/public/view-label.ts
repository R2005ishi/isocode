/** Message key (under `model.*`) describing which view an illustration shows, from its filename. */
export function viewKey(src: string): "viewFront" | "viewSide" | "viewRear" {
  if (/-side\.\w+$/.test(src)) return "viewSide";
  if (/-rear\.\w+$/.test(src)) return "viewRear";
  return "viewFront";
}

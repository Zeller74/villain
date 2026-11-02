//joins class names, skipping the ones switched off
export function cx(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

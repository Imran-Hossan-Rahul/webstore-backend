export const parseAmount = (val) => {
  if (typeof val === "number") return val;
  if (!val) return 0;
  if (String(val).includes("-")) {
    const parts = String(val).split("-").map(p => parseFloat(p.trim()) || 0);
    return Math.max(...parts);
  }
  return parseFloat(val) || 0;
};

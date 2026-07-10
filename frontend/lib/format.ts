export function formatCurrency(value: number | string) {
  const amount = Number(value ?? 0);

  return `PKR ${amount.toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

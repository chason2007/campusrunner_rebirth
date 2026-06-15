export const LIFECYCLE = ["PLACED", "ACCEPTED", "SHOPPING", "PURCHASED", "DELIVERED", "COMPLETED"];

export const STEP_LABEL = {
  PLACED: ["Order placed", "Finding a runner near you"],
  ACCEPTED: ["Runner assigned", "On the way to pick up"],
  SHOPPING: ["Shopping", "Grabbing your items"],
  PURCHASED: ["Items secured", "Bought & heading over"],
  DELIVERED: ["Delivered", "Dropped at your spot"],
  COMPLETED: ["Completed", "Order closed"],
};

// what step a runner advances TO from the current status, with button label
export const RUNNER_NEXT = {
  ACCEPTED: ["SHOPPING", "Arrived — start shopping"],
  SHOPPING: ["PURCHASED", "All items got — mark purchased"],
  PURCHASED: ["DELIVERED", "Delivered to buyer"],
};

export const RUNNER_FEE_PAISE = 2000;
export const PLATFORM_FEE_RATE = 0.08;

export const CATEGORIES = [
  { id: "all", emo: "🛒", label: "All" },
  { id: "food", emo: "🍔", label: "Food" },
  { id: "drinks", emo: "🥤", label: "Drinks" },
  { id: "print", emo: "🖨️", label: "Print" },
  { id: "stationery", emo: "✏️", label: "Stationery" },
  { id: "essentials", emo: "💊", label: "Essentials" },
];

export const PAYS = {
  WALLET: { ico: "◎", label: "Campus Wallet", bg: "var(--vendor-bg)" },
  UPI: { ico: "⊞", label: "UPI", hint: "Pay on confirm", bg: "#e3edff" },
  COD: { ico: "₹", label: "Cash on delivery", hint: "Pay runner directly", bg: "#e3f5e8" },
};

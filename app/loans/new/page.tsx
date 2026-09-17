import crypto from "crypto";
import { NewWholesaleLoanPage } from "./new-loan-form";

export const dynamic = "force-dynamic";

export default function Page() {
  const rand = crypto.randomInt(1000, 10000);
  const initialCode = `LA-${new Date().getFullYear()}-${rand}`;

  return <NewWholesaleLoanPage initialApplicationCode={initialCode} />;
}

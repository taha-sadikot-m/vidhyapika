"use client";

import { StrictMode } from "react";
import App from "../../App";

export default function SpaShellInner() {
  return (
    <StrictMode>
      <App />
    </StrictMode>
  );
}


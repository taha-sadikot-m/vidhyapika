"use client";

import dynamic from "next/dynamic";

const Spa = dynamic(() => import("./SpaShellInner"), { ssr: false });

export default function SpaShell() {
  return <Spa />;
}


"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function ShareDemoLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button variant="secondary" onClick={() => void copyLink()}>
      {copied ? "Link copied" : "Copy share link"}
    </Button>
  );
}

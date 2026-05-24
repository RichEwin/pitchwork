"use client";

import { useState } from "react";
import { PanelRightOpen, Music, Sparkles, Library, Upload, FlaskConical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { value: "ask", label: "Ask", icon: Sparkles, blurb: "Ask anything across the corpus. Answers cite passages from reviews and interviews." },
  { value: "library", label: "Library", icon: Library, blurb: "Browse, filter, and inspect every document and chunk you've ingested." },
  { value: "upload", label: "Upload", icon: Upload, blurb: "Drop in reviews, transcripts, or text. We chunk, embed, and index." },
  { value: "evals", label: "Evals", icon: FlaskConical, blurb: "Run retrieval and answer-quality evals against a held-out question set." },
] as const;

export function AppShell() {
  const [inspectorOpen, setInspectorOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
            <Music className="size-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">Pitchwork</span>
        </div>
        <Badge variant="secondary" className="font-mono text-xs">
          142 reviews
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInspectorOpen(true)}
            aria-label="Open inspector"
          >
            <PanelRightOpen className="size-4" />
            Inspector
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-4 py-6 sm:px-6">
        <Tabs defaultValue="ask" className="flex-1">
          <TabsList>
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value}>
                <Icon className="size-4" aria-hidden />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map(({ value, label, blurb }) => (
            <TabsContent key={value} value={value} className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>{label}</CardTitle>
                  <CardDescription>{blurb}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Coming soon.</p>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </main>

      <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Inspector</SheetTitle>
            <SheetDescription>
              Retrieval traces, sources, and debug info will appear here once you run a query.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 items-center justify-center px-6 pb-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing to inspect yet.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

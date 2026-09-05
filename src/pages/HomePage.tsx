import { ActivityPanel } from "@/components/ActivityPanel";
import { AssistantCore } from "@/components/AssistantCore";
import { CommandInput } from "@/components/CommandInput";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Transcript } from "@/components/Transcript";

/** Phase 1 home: status core, transcript, activity timeline, command input. */
export function HomePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 py-4">
      <AssistantCore />
      <div className="flex w-full min-h-0 flex-col items-center gap-4">
        <ErrorBanner />
        <Transcript />
        <ActivityPanel />
        <CommandInput />
      </div>
    </div>
  );
}

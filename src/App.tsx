import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLayout } from "@/layouts/AppLayout";
import { HomePage } from "@/pages/HomePage";
import { AgentProvider } from "@/stores/AgentProvider";

/** Composition root — kept thin; all logic lives in stores/agent/components. */
export function App() {
  return (
    <ErrorBoundary>
      <AgentProvider>
        <AppLayout>
          <HomePage />
        </AppLayout>
      </AgentProvider>
    </ErrorBoundary>
  );
}

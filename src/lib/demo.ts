import demoJson from "@/data/demo.json";
import type {
  AppState,
  AuditEntry,
  Benchmark,
  Hotel,
  ImportBatch,
  KpiYear,
  PipelineProject,
  SavedSelection,
  Task,
  Transaction,
  User,
} from "./types";

/**
 * Jeu de données de démonstration généré par scripts/generate-demo.mjs.
 * Tous les hôtels, montants et dirigeants sont fictifs (marqueur DÉMO).
 */
interface DemoBundle {
  generatedAt: string;
  hotels: Hotel[];
  kpis: KpiYear[];
  transactions: Transaction[];
  pipeline: PipelineProject[];
  users: User[];
  audit: AuditEntry[];
  tasks: Task[];
  savedSelections: SavedSelection[];
  benchmarks: Benchmark[];
  imports: ImportBatch[];
  initialState: {
    basket: string[];
    referenceId: string | null;
    currentUserId: string;
  };
}

export const demoBundle = demoJson as unknown as DemoBundle;

export function buildInitialState(): AppState {
  const { initialState, ...rest } = demoBundle;
  return {
    ...rest,
    kpiHistory: [],
    basket: [...initialState.basket],
    referenceId: initialState.referenceId,
    currentUserId: initialState.currentUserId,
  };
}

export const DEMO_GENERATED_AT = demoBundle.generatedAt;

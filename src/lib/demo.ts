import baseJson from "@/data/nova-base.json";
import type {
  AppState,
  AuditEntry,
  Benchmark,
  ExploitationYear,
  Hotel,
  IdentityObservation,
  ImportBatch,
  KpiYear,
  MiceObservation,
  PipelineProject,
  PriceObservation,
  SavedSelection,
  Task,
  Transaction,
  User,
  ValuationObservation,
} from "./types";

/**
 * Base compilée à partir du classeur « BDD transactions hôtelières - vcompilée ».
 * Les montants, surfaces et équipements proviennent du fichier fourni ; les
 * dimensions absentes restent nulles et ne sont jamais extrapolées.
 */
interface BaseBundle {
  generatedAt: string;
  sourceFile: string;
  sourceSheet: string;
  referenceYear: number;
  hotels: Hotel[];
  kpis: KpiYear[];
  kpiHistory: KpiYear[];
  transactions: Transaction[];
  exploitations: ExploitationYear[];
  priceObservations: PriceObservation[];
  miceObservations: MiceObservation[];
  valuations: ValuationObservation[];
  identities: IdentityObservation[];
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

export const demoBundle = baseJson as unknown as BaseBundle;

export function buildInitialState(): AppState {
  const { initialState, ...rest } = demoBundle;
  return {
    ...rest,
    kpiHistory: rest.kpiHistory ?? [],
    exploitations: rest.exploitations ?? [],
    priceObservations: rest.priceObservations ?? [],
    miceObservations: rest.miceObservations ?? [],
    valuations: rest.valuations ?? [],
    identities: rest.identities ?? [],
    basket: [...initialState.basket],
    referenceId: initialState.referenceId,
    currentUserId: initialState.currentUserId,
  };
}

export const DEMO_GENERATED_AT = demoBundle.generatedAt;

export const BASE_INFO = {
  sourceFile: demoBundle.sourceFile,
  sourceSheet: demoBundle.sourceSheet,
  referenceYear: demoBundle.referenceYear,
  generatedAt: demoBundle.generatedAt,
};

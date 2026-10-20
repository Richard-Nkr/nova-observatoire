"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { buildInitialState } from "./demo";
import type {
  AppState,
  AuditEntry,
  Benchmark,
  Hotel,
  ImportBatch,
  KpiYear,
  SavedSelection,
  SourceRef,
  Task,
  Transaction,
  User,
} from "./types";

const STORAGE_KEY = "nova-observatoire-v2";

export interface KpiUpsertPayload {
  hotelId: string;
  annee: number;
  values: Partial<Omit<KpiYear, "id" | "hotelId" | "annee" | "source">>;
  source: SourceRef;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

interface StoreContextValue {
  state: AppState;
  hydrated: boolean;
  currentUser: User;
  toggleBasket: (hotelId: string) => void;
  clearBasket: () => void;
  setBasket: (hotelIds: string[]) => void;
  setReference: (hotelId: string | null) => void;
  saveSelection: (
    selection: Omit<SavedSelection, "id" | "createdAt" | "auteur">,
  ) => SavedSelection;
  deleteSelection: (id: string) => void;
  saveBenchmark: (benchmark: Omit<Benchmark, "id" | "createdAt" | "updatedAt" | "version">) => Benchmark;
  deleteBenchmark: (id: string) => void;
  addAudit: (entry: Omit<AuditEntry, "id" | "date" | "userId">) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  addTask: (task: Omit<Task, "id">) => void;
  createHotel: (hotel: Omit<Hotel, "id" | "createdAt" | "updatedAt" | "demo">) => Hotel;
  updateHotel: (id: string, patch: Partial<Hotel>) => void;
  addTransaction: (transaction: Omit<Transaction, "id">) => void;
  addImport: (batch: Omit<ImportBatch, "id" | "date" | "auteur">) => void;
  setCurrentUser: (id: string) => void;
  updateUser: (id: string, patch: Partial<User>) => void;
  addUser: (user: Omit<User, "id" | "initiales">) => void;
  upsertKpi: (payload: KpiUpsertPayload) => ActionResult;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const RELIABILITY_RANK = { N1: 1, N2: 2, N3: 3 } as const;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(buildInitialState);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppState;
        if (parsed?.hotels?.length) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setState({
            ...buildInitialState(),
            ...parsed,
            kpiHistory: parsed.kpiHistory ?? [],
            exploitations: parsed.exploitations ?? [],
            priceObservations: parsed.priceObservations ?? [],
            miceObservations: parsed.miceObservations ?? [],
            valuations: parsed.valuations ?? [],
            identities: parsed.identities ?? [],
          });
        }
      }
    } catch {
      // Un stockage corrompu ne doit jamais bloquer l'application.
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Quota dépassé : on conserve la session en mémoire.
    }
  }, [state, hydrated]);

  const currentUser = useMemo(
    () => state.users.find((user) => user.id === state.currentUserId) ?? state.users[0],
    [state.users, state.currentUserId],
  );

  const appendAudit = useCallback(
    (prev: AppState, entry: Omit<AuditEntry, "id" | "date" | "userId">): AuditEntry[] => [
      {
        id: uid("audit"),
        date: new Date().toISOString(),
        userId: prev.currentUserId,
        ...entry,
      },
      ...prev.audit,
    ],
    [],
  );

  const toggleBasket = useCallback((hotelId: string) => {
    setState((prev) => ({
      ...prev,
      basket: prev.basket.includes(hotelId)
        ? prev.basket.filter((id) => id !== hotelId)
        : prev.basket.length >= 30
          ? prev.basket
          : [...prev.basket, hotelId],
    }));
  }, []);

  const clearBasket = useCallback(() => {
    setState((prev) => ({ ...prev, basket: [] }));
  }, []);

  const setBasket = useCallback((hotelIds: string[]) => {
    setState((prev) => ({ ...prev, basket: hotelIds.slice(0, 30) }));
  }, []);

  const setReference = useCallback((hotelId: string | null) => {
    setState((prev) => ({ ...prev, referenceId: hotelId }));
  }, []);

  const saveSelection = useCallback(
    (selection: Omit<SavedSelection, "id" | "createdAt" | "auteur">) => {
      const created: SavedSelection = {
        ...selection,
        id: uid("sel"),
        createdAt: new Date().toISOString(),
        auteur: stateRef.current.users.find((u) => u.id === stateRef.current.currentUserId)?.nom ?? "Consultant",
      };
      setState((prev) => ({
        ...prev,
        savedSelections: [created, ...prev.savedSelections],
        audit: appendAudit(prev, {
          action: "Création d'une sélection",
          target: created.nom,
          details: `${created.hotelIds.length} hôtels`,
        }),
      }));
      return created;
    },
    [appendAudit],
  );

  const deleteSelection = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        savedSelections: prev.savedSelections.filter((item) => item.id !== id),
        audit: appendAudit(prev, {
          action: "Suppression d'une sélection",
          target: prev.savedSelections.find((item) => item.id === id)?.nom ?? id,
          details: "",
        }),
      }));
    },
    [appendAudit],
  );

  const saveBenchmark = useCallback(
    (benchmark: Omit<Benchmark, "id" | "createdAt" | "updatedAt" | "version">) => {
      const now = new Date().toISOString();
      const existing = stateRef.current.benchmarks.find(
        (item) => item.nom === benchmark.nom && item.client === benchmark.client,
      );
      const created: Benchmark = {
        ...benchmark,
        id: existing?.id ?? uid("bench"),
        version: existing ? existing.version + 1 : 1,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      setState((prev) => ({
        ...prev,
        benchmarks: [created, ...prev.benchmarks.filter((item) => item.id !== created.id)],
        audit: appendAudit(prev, {
          action: existing ? "Nouvelle version de benchmark" : "Création d'un benchmark",
          target: `${created.nom} — ${created.client}`,
          details: `${created.hotelIds.length} hôtels, version ${created.version}`,
        }),
      }));
      return created;
    },
    [appendAudit],
  );

  const deleteBenchmark = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        benchmarks: prev.benchmarks.filter((item) => item.id !== id),
        audit: appendAudit(prev, {
          action: "Suppression d'un benchmark",
          target: prev.benchmarks.find((item) => item.id === id)?.nom ?? id,
          details: "",
        }),
      }));
    },
    [appendAudit],
  );

  const addAudit = useCallback(
    (entry: Omit<AuditEntry, "id" | "date" | "userId">) => {
      setState((prev) => ({ ...prev, audit: appendAudit(prev, entry) }));
    },
    [appendAudit],
  );

  const updateTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)),
        audit: appendAudit(prev, {
          action: "Mise à jour d'une tâche",
          target: prev.tasks.find((task) => task.id === id)?.hotelNom ?? id,
          details: patch.statut ? `Statut : ${patch.statut}` : "Mise à jour",
        }),
      }));
    },
    [appendAudit],
  );

  const addTask = useCallback(
    (task: Omit<Task, "id">) => {
      setState((prev) => ({
        ...prev,
        tasks: [{ ...task, id: uid("task") }, ...prev.tasks],
        audit: appendAudit(prev, {
          action: "Création d'une tâche",
          target: task.hotelNom,
          details: task.champ,
        }),
      }));
    },
    [appendAudit],
  );

  const createHotel = useCallback(
    (hotel: Omit<Hotel, "id" | "createdAt" | "updatedAt" | "demo">) => {
      const now = new Date().toISOString();
      const created: Hotel = {
        ...hotel,
        id: uid("hotel"),
        demo: false,
        createdAt: now,
        updatedAt: now,
      };
      setState((prev) => ({
        ...prev,
        hotels: [created, ...prev.hotels],
        audit: appendAudit(prev, {
          action: "Création d'une fiche hôtel",
          target: created.nom,
          details: `${created.ville} — ${created.source.fiabilite}`,
        }),
      }));
      return created;
    },
    [appendAudit],
  );

  const updateHotel = useCallback(
    (id: string, patch: Partial<Hotel>) => {
      setState((prev) => ({
        ...prev,
        hotels: prev.hotels.map((hotel) =>
          hotel.id === id ? { ...hotel, ...patch, updatedAt: new Date().toISOString() } : hotel,
        ),
        audit: appendAudit(prev, {
          action: "Modification d'une fiche hôtel",
          target: prev.hotels.find((hotel) => hotel.id === id)?.nom ?? id,
          details: Object.keys(patch).join(", "),
        }),
      }));
    },
    [appendAudit],
  );

  const addTransaction = useCallback(
    (transaction: Omit<Transaction, "id">) => {
      setState((prev) => ({
        ...prev,
        transactions: [{ ...transaction, id: uid("txn") }, ...prev.transactions],
        audit: appendAudit(prev, {
          action: "Ajout d'une transaction",
          target: prev.hotels.find((hotel) => hotel.id === transaction.hotelId)?.nom ?? transaction.hotelId,
          details:
            transaction.prix !== null
              ? `${transaction.type ?? "Nature non documentée"} — ${transaction.prix.toLocaleString("fr-FR")} €`
              : transaction.caAvant !== null || transaction.caApres !== null
                ? "Transaction documentée par CA avant/après"
                : "Transaction sans prix ni CA documenté",
          confidential: transaction.confidentielClient,
        }),
      }));
    },
    [appendAudit],
  );

  const addImport = useCallback(
    (batch: Omit<ImportBatch, "id" | "date" | "auteur">) => {
      setState((prev) => ({
        ...prev,
        imports: [
          {
            ...batch,
            id: uid("import"),
            date: new Date().toISOString(),
            auteur: prev.users.find((user) => user.id === prev.currentUserId)?.nom ?? "Consultant",
          },
          ...prev.imports,
        ],
        audit: appendAudit(prev, {
          action: "Import de données",
          target: batch.fichier,
          details: `${batch.lignes} lignes`,
        }),
      }));
    },
    [appendAudit],
  );

  const setCurrentUser = useCallback((id: string) => {
    setState((prev) => ({ ...prev, currentUserId: id }));
  }, []);

  const updateUser = useCallback(
    (id: string, patch: Partial<User>) => {
      setState((prev) => ({
        ...prev,
        users: prev.users.map((user) => (user.id === id ? { ...user, ...patch } : user)),
        audit: appendAudit(prev, {
          action: "Modification d'un utilisateur",
          target: prev.users.find((user) => user.id === id)?.nom ?? id,
          details: Object.keys(patch).join(", "),
        }),
      }));
    },
    [appendAudit],
  );

  /**
   * Règle de conflit : une valeur N1 n'est jamais écrasée par N2/N3.
   * À niveau égal, la plus récente remplace l'ancienne, conservée dans l'historique.
   * Une valeur de fiabilité inférieure ne peut pas remplacer une valeur plus fiable.
   */
  const addUser = useCallback(
    (user: Omit<User, "id" | "initiales">) => {
      const initiales = user.nom
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .slice(0, 2)
        .join("");
      setState((prev) => ({
        ...prev,
        users: [...prev.users, { ...user, id: uid("user"), initiales }],
        audit: appendAudit(prev, {
          action: "Création d'un utilisateur",
          target: user.nom,
          details: `${user.role} — ${user.email}`,
        }),
      }));
    },
    [appendAudit],
  );

  const upsertKpi = useCallback(
    (payload: KpiUpsertPayload): ActionResult => {
      const prev = stateRef.current;
      const existing = prev.kpis.find(
        (kpi) => kpi.hotelId === payload.hotelId && kpi.annee === payload.annee,
      );
      const incomingRank = RELIABILITY_RANK[payload.source.fiabilite];
      if (existing) {
        const existingRank = RELIABILITY_RANK[existing.source.fiabilite];
        if (existingRank < incomingRank) {
          return {
            ok: false,
            message: `Conflit bloqué : la valeur existante ${existing.source.fiabilite} ne peut pas être remplacée par ${payload.source.fiabilite}.`,
          };
        }
      }
      const hotel = prev.hotels.find((item) => item.id === payload.hotelId);
      setState((current) => {
        const previous = current.kpis.find(
          (kpi) => kpi.hotelId === payload.hotelId && kpi.annee === payload.annee,
        );
        const record: KpiYear = {
          id: previous?.id ?? uid("kpi"),
          hotelId: payload.hotelId,
          annee: payload.annee,
          caTotal: null,
          caHebergement: null,
          caFnb: null,
          caAutres: null,
          to: null,
          adr: null,
          revpar: null,
          ebitda: null,
          ebitdaPct: null,
          gop: null,
          effectif: null,
          note: null,
          nbAvis: null,
          ...(previous ?? {}),
          ...payload.values,
          source: payload.source,
        };
        return {
          ...current,
          kpis: previous
            ? current.kpis.map((kpi) => (kpi.id === previous.id ? record : kpi))
            : [...current.kpis, record],
          kpiHistory: previous
            ? [{ ...previous, id: uid("hist") }, ...current.kpiHistory]
            : current.kpiHistory,
          audit: appendAudit(current, {
            action: previous ? "Mise à jour d'un indicateur" : "Ajout d'un indicateur",
            target: `${hotel?.nom ?? payload.hotelId} — ${payload.annee}`,
            details: `Source ${payload.source.fiabilite} : ${payload.source.source}`,
          }),
        };
      });
      return { ok: true, message: existing ? "Indicateur mis à jour." : "Indicateur ajouté." };
    },
    [appendAudit],
  );

  const resetDemo = useCallback(() => {
    setState(buildInitialState());
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      hydrated,
      currentUser,
      toggleBasket,
      clearBasket,
      setBasket,
      setReference,
      saveSelection,
      deleteSelection,
      saveBenchmark,
      deleteBenchmark,
      addAudit,
      updateTask,
      addTask,
      createHotel,
      updateHotel,
      addTransaction,
      addImport,
      setCurrentUser,
      updateUser,
      addUser,
      upsertKpi,
      resetDemo,
    }),
    [
      state,
      hydrated,
      currentUser,
      toggleBasket,
      clearBasket,
      setBasket,
      setReference,
      saveSelection,
      deleteSelection,
      saveBenchmark,
      deleteBenchmark,
      addAudit,
      updateTask,
      addTask,
      createHotel,
      updateHotel,
      addTransaction,
      addImport,
      setCurrentUser,
      updateUser,
      addUser,
      upsertKpi,
      resetDemo,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore doit être utilisé dans StoreProvider");
  return context;
}
